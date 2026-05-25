import type { Namespace, Server, Socket } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '../../core/src/events';
import type { Room } from '../../core/src/types';
import {
  createComponentLogger,
  readLoggingConfig,
} from '../../../../apps/platform/server/logging/logger';
import {
  attachSocketEventDebugLogging,
  createSocketLogger,
} from '../../../../apps/platform/server/logging/socketLogger';
import { startSocketHandlerInstrumentation } from '../../../../apps/platform/server/observability/socketHandlerMetrics';
import {
  recordNamespaceConnection,
  recordNamespaceDisconnect,
} from '../../../../apps/platform/server/observability/socketNamespaceMetrics';
import {
  MAX_PLAYERS,
  MIN_PLAYERS,
  ROOM_ENDED_CLEANUP_MS,
  ROOM_IDLE_TIMEOUT_MS,
} from '../../core/src/constants';
import {
  createRoom,
  getRoom,
  getSessionRoom,
  setSessionToRoom,
  clearRoomCleanup,
  scheduleRoomCleanup,
} from './models/room';
import { createPlayer, deleteSocketIndex, getSocketIndex, setSocketIndex } from './models/player';
import { broadcastRoom, sendRoomToPlayer } from './managers/broadcastManager';
import {
  beginFirstTrickIfReady,
  flipPlayerRow,
  keepPlayerRow,
  passAndScout,
  playCards,
  resetToLobby,
  startGame,
} from './managers/trickManager';

type ScoutSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

function normalizeStablePlayerId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function assignHost(room: Room, newHostId: string): void {
  const nextHost = room.players[newHostId];
  if (!nextHost) return;
  if (room.hostId) {
    const currentHost = room.players[room.hostId];
    if (currentHost) currentHost.isHost = false;
  }
  room.hostId = newHostId;
  nextHost.isHost = true;
}

function verifyIsHost(socket: ScoutSocket, room: Room): boolean {
  const index = getSocketIndex(socket.id);
  return index !== undefined && index.roomCode === room.code && index.playerId === room.hostId;
}

function verifyPlayerInRoom(socket: ScoutSocket, roomCode: string): string | null {
  const index = getSocketIndex(socket.id);
  if (!index || index.roomCode !== roomCode) return null;
  return index.playerId;
}

function detachIndexedSocket(nsp: Namespace, socketId: string): void {
  const index = getSocketIndex(socketId);
  if (!index) return;
  const room = getRoom(index.roomCode);
  if (room) {
    const player = room.players[index.playerId];
    if (player?.socketId === socketId) {
      player.connected = false;
      player.socketId = null;
    }
  }
  deleteSocketIndex(socketId);
  nsp.sockets.get(socketId)?.leave(index.roomCode);
}

function bindPlayerToSocket(
  nsp: Namespace,
  socket: ScoutSocket,
  room: Room,
  playerId: string
): void {
  const player = room.players[playerId];
  if (!player) return;

  if (player.socketId && player.socketId !== socket.id) {
    const prev = player.socketId;
    detachIndexedSocket(nsp, prev);
    nsp.sockets.get(prev)?.disconnect(true);
  }

  const currentIndex = getSocketIndex(socket.id);
  if (currentIndex && (currentIndex.roomCode !== room.code || currentIndex.playerId !== playerId)) {
    detachIndexedSocket(nsp, socket.id);
  }

  player.socketId = socket.id;
  player.connected = true;
  setSocketIndex(socket.id, room.code, player.id);
  clearRoomCleanup(room.code);
  socket.join(room.code);
}

function callbackErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Invalid action';
}

export function registerScout(io: Server, namespace = '/g/scout'): void {
  const gameId = 'scout';
  const nsp = io.of(namespace);
  const gameLogger = createComponentLogger('game-server', { gameId, namespace });
  const socketEventDebugEnabled = readLoggingConfig().socketEvents;

  nsp.use((socket, next) => {
    const auth = socket.handshake.auth || {};
    socket.data.sessionId = auth.sessionId;
    socket.data.playerId = auth.playerId;
    next();
  });

  nsp.on('connection', (socket: ScoutSocket) => {
    const socketLogger = createSocketLogger(gameLogger, socket);
    attachSocketEventDebugLogging(socket, socketLogger, socketEventDebugEnabled);
    recordNamespaceConnection({ namespace, gameId }, nsp);
    socketLogger.debug('scout client connected');

    socket.on('autoJoinRoom', (data, cb) => {
      const instrumentation = startSocketHandlerInstrumentation(namespace, 'autoJoinRoom', gameId);
      const respond = instrumentation.wrapCallback(cb);
      try {
        const sessionId = data.sessionId?.trim();
        const name = data.name?.trim();
        const wantsHost = data.isHost === true;
        const stablePlayerId =
          normalizeStablePlayerId(data.playerId) ?? normalizeStablePlayerId(socket.data.playerId);

        if (!sessionId || !name) return respond({ ok: false, error: 'Missing session info' });

        const roomCode = getSessionRoom(sessionId);
        const existingRoom = roomCode ? getRoom(roomCode) : undefined;

        if (existingRoom) {
          const indexedPlayerId =
            getSocketIndex(socket.id)?.roomCode === existingRoom.code
              ? getSocketIndex(socket.id)?.playerId
              : undefined;
          const reconnectPlayerId = stablePlayerId ?? indexedPlayerId;

          if (reconnectPlayerId && existingRoom.players[reconnectPlayerId]) {
            const player = existingRoom.players[reconnectPlayerId];
            if (data.resumeToken && player.resumeToken !== data.resumeToken) {
              socketLogger.warn(
                { roomCode: existingRoom.code, playerId: player.id, sessionId },
                'autoJoinRoom rejected: invalid scout resume token'
              );
              return respond({ ok: false, error: 'Invalid resume token' });
            }
            if (!data.resumeToken && player.resumeToken) {
              socketLogger.warn(
                { roomCode: existingRoom.code, playerId: player.id, sessionId },
                'autoJoinRoom rejected: scout resume token required'
              );
              return respond({ ok: false, error: 'Resume token required' });
            }
            bindPlayerToSocket(nsp, socket, existingRoom, reconnectPlayerId);
            if (wantsHost) {
              assignHost(existingRoom, reconnectPlayerId);
              existingRoom.ownerId = reconnectPlayerId;
            }
            broadcastRoom(nsp, existingRoom);
            socketLogger.info(
              { roomCode: existingRoom.code, playerId: player.id, sessionId, resumed: true },
              'player rejoined scout room'
            );
            return respond({
              ok: true,
              roomCode: existingRoom.code,
              playerId: player.id,
              resumeToken: player.resumeToken,
            });
          }

          const nameExists = Object.values(existingRoom.players).some(
            (p) => p.id !== stablePlayerId && p.name.toLowerCase() === name.toLowerCase()
          );
          if (nameExists) return respond({ ok: false, error: 'Name already taken' });
          if (existingRoom.phase !== 'lobby') {
            return respond({ ok: false, error: 'Game already started' });
          }
          if (existingRoom.playerOrder.length >= MAX_PLAYERS) {
            return respond({ ok: false, error: 'Room is full' });
          }

          const player = createPlayer(name, false, stablePlayerId ?? undefined);
          existingRoom.players[player.id] = player;
          existingRoom.playerOrder.push(player.id);
          bindPlayerToSocket(nsp, socket, existingRoom, player.id);
          if (wantsHost) {
            assignHost(existingRoom, player.id);
            existingRoom.ownerId = player.id;
          }
          broadcastRoom(nsp, existingRoom);
          socketLogger.info(
            { roomCode: existingRoom.code, playerId: player.id, sessionId, resumed: false },
            'player joined existing scout room'
          );
          return respond({
            ok: true,
            roomCode: existingRoom.code,
            playerId: player.id,
            resumeToken: player.resumeToken,
          });
        }

        const { room, hostId, resumeToken } = createRoom(
          name,
          socket.id,
          stablePlayerId ?? undefined
        );
        setSessionToRoom(sessionId, room.code);
        clearRoomCleanup(room.code);
        socket.join(room.code);
        if (wantsHost) assignHost(room, hostId);
        broadcastRoom(nsp, room);
        socketLogger.info(
          { roomCode: room.code, playerId: hostId, sessionId },
          'created scout room'
        );
        return respond({ ok: true, roomCode: room.code, playerId: hostId, resumeToken });
      } catch (err) {
        instrumentation.finishError();
        throw err;
      }
    });

    socket.on('startGame', (data, cb) => {
      const instrumentation = startSocketHandlerInstrumentation(namespace, 'startGame', gameId);
      const respond = instrumentation.wrapCallback(cb);
      try {
        const room = getRoom(data.roomCode);
        if (!room) return respond({ ok: false, error: 'Room not found' });
        if (!verifyIsHost(socket, room))
          return respond({ ok: false, error: 'Only host can start' });
        if (room.phase !== 'lobby') return respond({ ok: false, error: 'Game already started' });
        const connectedPlayers = Object.values(room.players).filter((p) => p.connected);
        if (connectedPlayers.length < MIN_PLAYERS) {
          return respond({ ok: false, error: `Need at least ${MIN_PLAYERS} players` });
        }

        startGame(room);
        broadcastRoom(nsp, room);
        socketLogger.info(
          {
            roomCode: room.code,
            hostPlayerId: room.hostId,
            connectedPlayers: connectedPlayers.length,
          },
          'started scout game'
        );
        return respond({ ok: true });
      } catch (err) {
        instrumentation.finishError();
        throw err;
      }
    });

    socket.on('flipRow', (data, cb) => {
      const instrumentation = startSocketHandlerInstrumentation(namespace, 'flipRow', gameId);
      const respond = instrumentation.wrapCallback(cb);
      try {
        const room = getRoom(data.roomCode);
        if (!room || room.phase !== 'playing')
          return respond({ ok: false, error: 'Room not found' });
        const playerId = verifyPlayerInRoom(socket, data.roomCode);
        if (!playerId) return respond({ ok: false, error: 'Not in room' });
        const player = room.players[playerId];
        if (data.flip) flipPlayerRow(player);
        else keepPlayerRow(player);
        beginFirstTrickIfReady(room);
        broadcastRoom(nsp, room);
        socketLogger.info(
          { roomCode: room.code, playerId, flipped: data.flip },
          'scout setup choice made'
        );
        return respond({ ok: true });
      } catch (err) {
        return respond({ ok: false, error: callbackErrorMessage(err) });
      }
    });

    socket.on('playCards', (data, cb) => {
      const instrumentation = startSocketHandlerInstrumentation(namespace, 'playCards', gameId);
      const respond = instrumentation.wrapCallback(cb);
      try {
        const room = getRoom(data.roomCode);
        if (!room || room.phase !== 'playing')
          return respond({ ok: false, error: 'Room not found' });
        const playerId = verifyPlayerInRoom(socket, data.roomCode);
        if (!playerId) return respond({ ok: false, error: 'Not in room' });
        playCards(room, playerId, data.startIndex, data.count);
        broadcastRoom(nsp, room);
        const ended = (room.phase as Room['phase']) === 'ended';
        socketLogger.info(
          { roomCode: room.code, playerId, count: data.count, ended },
          'scout cards played'
        );
        if (ended) {
          gameLogger.info(
            { roomCode: room.code, winnerIds: room.winnerIds, reason: room.gameEndReason },
            'scout game ended'
          );
          scheduleRoomCleanup(room.code, ROOM_ENDED_CLEANUP_MS);
        }
        return respond({ ok: true });
      } catch (err) {
        return respond({ ok: false, error: callbackErrorMessage(err) });
      }
    });

    socket.on('pass', (data, cb) => {
      const instrumentation = startSocketHandlerInstrumentation(namespace, 'pass', gameId);
      const respond = instrumentation.wrapCallback(cb);
      try {
        const room = getRoom(data.roomCode);
        if (!room || room.phase !== 'playing')
          return respond({ ok: false, error: 'Room not found' });
        const playerId = verifyPlayerInRoom(socket, data.roomCode);
        if (!playerId) return respond({ ok: false, error: 'Not in room' });
        passAndScout(room, playerId, data.source, data.side, data.cardId, data.fromPlayerId);
        broadcastRoom(nsp, room);
        socketLogger.info(
          { roomCode: room.code, playerId, source: data.source, side: data.side },
          'scout player passed'
        );
        const ended = (room.phase as Room['phase']) === 'ended';
        if (ended) {
          gameLogger.info(
            { roomCode: room.code, winnerIds: room.winnerIds, reason: room.gameEndReason },
            'scout game ended'
          );
          scheduleRoomCleanup(room.code, ROOM_ENDED_CLEANUP_MS);
        }
        return respond({ ok: true });
      } catch (err) {
        return respond({ ok: false, error: callbackErrorMessage(err) });
      }
    });

    socket.on('playAgain', (data, cb) => {
      const instrumentation = startSocketHandlerInstrumentation(namespace, 'playAgain', gameId);
      const respond = instrumentation.wrapCallback(cb);
      try {
        const room = getRoom(data.roomCode);
        if (!room) return respond({ ok: false, error: 'Room not found' });
        if (!verifyIsHost(socket, room))
          return respond({ ok: false, error: 'Only host can restart' });
        if (room.phase !== 'ended') return respond({ ok: false, error: 'Game is not over' });
        resetToLobby(room);
        clearRoomCleanup(room.code);
        broadcastRoom(nsp, room);
        socketLogger.info({ roomCode: room.code }, 'scout game reset to lobby');
        return respond({ ok: true });
      } catch (err) {
        instrumentation.finishError();
        throw err;
      }
    });

    socket.on('requestState', (data, cb) => {
      const instrumentation = startSocketHandlerInstrumentation(namespace, 'requestState', gameId);
      const respond = cb ? instrumentation.wrapCallback(cb) : undefined;
      try {
        const room = getRoom(data.roomCode);
        if (!room) {
          respond?.({ ok: false, error: 'Room not found' });
          instrumentation.finishRejected();
          return;
        }
        const playerId = verifyPlayerInRoom(socket, data.roomCode);
        if (!playerId) {
          respond?.({ ok: false, error: 'Not in room' });
          instrumentation.finishRejected();
          return;
        }
        sendRoomToPlayer(nsp, room, playerId);
        respond?.({ ok: true });
        instrumentation.finishSuccess();
      } catch (err) {
        instrumentation.finishError();
        throw err;
      }
    });

    socket.on('disconnect', (reason) => {
      const instrumentation = startSocketHandlerInstrumentation(namespace, 'disconnect', gameId);
      try {
        const index = getSocketIndex(socket.id);
        if (!index) {
          recordNamespaceDisconnect({ namespace, gameId }, nsp);
          instrumentation.finishSuccess();
          return;
        }

        const room = getRoom(index.roomCode);
        if (room) {
          const player = room.players[index.playerId];
          if (player) {
            const wasHost = player.isHost;
            player.connected = false;
            player.socketId = null;

            if (wasHost) {
              const remaining = room.playerOrder.map((id) => room.players[id]);
              const newHost =
                remaining.find((p) => p.id !== index.playerId && p.connected) ??
                remaining.find((p) => p.id !== index.playerId);
              if (newHost) assignHost(room, newHost.id);
              else room.hostId = null;
            }

            broadcastRoom(nsp, room);
            const allDisconnected = Object.values(room.players).every((p) => !p.connected);
            if (allDisconnected) scheduleRoomCleanup(room.code, ROOM_IDLE_TIMEOUT_MS);
          }
        }

        deleteSocketIndex(socket.id);
        socketLogger.info(
          { reason, roomCode: index.roomCode, playerId: index.playerId },
          'scout client disconnected'
        );
        recordNamespaceDisconnect({ namespace, gameId }, nsp);
        instrumentation.finishSuccess();
      } catch (err) {
        instrumentation.finishError();
        throw err;
      }
    });
  });
}
