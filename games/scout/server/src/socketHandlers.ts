import type { Namespace, Server, Socket } from 'socket.io';
import type {
  AutoJoinRoomResponse,
  BasicResponse,
  ClientToServerEvents,
  ErrorResponse,
  ServerToClientEvents,
} from '../../core/src/events';
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
import { getPartyByActiveMatch } from '../../../../apps/platform/server/party/partyStore';
import type { PartyMember } from '../../../../apps/platform/server/party/types';
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
  getRoomSession,
  setSessionToRoom,
  clearRoomCleanup,
  scheduleRoomCleanup,
} from './models/room';
import { createPlayer, deleteSocketIndex, getSocketIndex, setSocketIndex } from './models/player';
import { broadcastRoom, sendRoomToPlayer } from './managers/broadcastManager';
import {
  beginFirstTrickIfReady,
  flipPlayerRow,
  handlePlayerDisconnected,
  keepPlayerRow,
  passAndScout,
  playCards,
  resetToLobby,
  startGame,
} from './managers/trickManager';

type ScoutSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

const INVALID_REQUEST_ERROR = 'Invalid request';

type ScoutSource = 'showPile' | 'table';
type ScoutSide = 'left' | 'right';

function isObjectPayload(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeRequiredString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function isScoutSource(value: unknown): value is ScoutSource {
  return value === 'showPile' || value === 'table';
}

function isScoutSide(value: unknown): value is ScoutSide {
  return value === 'left' || value === 'right';
}

function normalizeStablePlayerId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function assignHost(room: Room, newHostId: string): void {
  const nextHost = room.players[newHostId];
  if (!nextHost) return;
  for (const player of Object.values(room.players)) {
    player.isHost = player.id === newHostId;
  }
  room.hostId = newHostId;
}

function clearHost(room: Room): void {
  for (const player of Object.values(room.players)) {
    player.isHost = false;
  }
  room.hostId = null;
}

function restoreHostToFirstConnectedPlayer(room: Room): boolean {
  if (room.hostId !== null) return false;
  const nextHostId = room.playerOrder.find((playerId) => room.players[playerId]?.connected);
  if (!nextHostId) {
    clearHost(room);
    return false;
  }
  assignHost(room, nextHostId);
  return true;
}

function syncRoomHostFromParty(room: Room, hostPlayerId: string): void {
  room.ownerId = hostPlayerId;
  if (room.players[hostPlayerId]) {
    assignHost(room, hostPlayerId);
  } else {
    clearHost(room);
  }
}

function syncRoomHostFromActiveParty(room: Room, gameId: string): boolean {
  const sessionId = getRoomSession(room.code);
  const party = sessionId ? getPartyByActiveMatch(sessionId, gameId) : undefined;
  if (!party) return false;
  syncRoomHostFromParty(room, party.hostPlayerId);
  return true;
}

function syncRoomHostAfterJoin(room: Room, hostPlayerId: string): void {
  if (restoreHostToFirstConnectedPlayer(room)) return;
  syncRoomHostFromParty(room, hostPlayerId);
  restoreHostToFirstConnectedPlayer(room);
}

function verifyIsHost(socket: ScoutSocket, room: Room): boolean {
  const index = getSocketIndex(socket.id);
  if (!index || index.roomCode !== room.code || index.playerId !== room.hostId) return false;

  const sessionId = getRoomSession(room.code);
  const party = sessionId ? getPartyByActiveMatch(sessionId, 'scout') : undefined;
  if (!party || party.hostPlayerId === index.playerId) return true;

  const partyHost = party.members.get(party.hostPlayerId);
  return !partyHost?.connected;
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

function normalizeJoinToken(payloadValue: unknown, socketValue: unknown): string | null {
  const value = typeof payloadValue === 'string' ? payloadValue : socketValue;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function authorizePartyJoin(
  matchKey: string,
  playerId: string | null,
  joinToken: string | null
):
  | { ok: true; member: PartyMember; hostPlayerId: string; isHost: boolean }
  | { ok: false; error: string; reason: string } {
  if (!playerId) {
    return { ok: false, error: 'Missing player info', reason: 'missing_player_id' };
  }

  const party = getPartyByActiveMatch(matchKey, 'scout');
  if (!party) {
    return { ok: false, error: 'Match not found', reason: 'match_not_found' };
  }

  const member = party.members.get(playerId);
  if (!member) {
    return { ok: false, error: 'Not authorized for this match', reason: 'member_not_found' };
  }

  if (!joinToken || member.resumeToken !== joinToken) {
    return { ok: false, error: 'Not authorized for this match', reason: 'invalid_join_token' };
  }

  return {
    ok: true,
    member,
    hostPlayerId: party.hostPlayerId,
    isHost: party.hostPlayerId === playerId,
  };
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
    socket.data.joinToken = auth.joinToken || auth.token;
    next();
  });

  nsp.on('connection', (socket: ScoutSocket) => {
    const socketLogger = createSocketLogger(gameLogger, socket);
    attachSocketEventDebugLogging(socket, socketLogger, socketEventDebugEnabled);
    recordNamespaceConnection({ namespace, gameId }, nsp);
    socketLogger.debug('scout client connected');

    socket.on('autoJoinRoom', (data: unknown, cb: unknown) => {
      const instrumentation = startSocketHandlerInstrumentation(namespace, 'autoJoinRoom', gameId);
      const respond: (result: AutoJoinRoomResponse | ErrorResponse) => void =
        typeof cb === 'function'
          ? instrumentation.wrapCallback(
              cb as (result: AutoJoinRoomResponse | ErrorResponse) => void
            )
          : () => {};
      try {
        if (!isObjectPayload(data)) return respond({ ok: false, error: INVALID_REQUEST_ERROR });

        const sessionId = normalizeRequiredString(data.sessionId);
        if (!sessionId) return respond({ ok: false, error: INVALID_REQUEST_ERROR });

        const stablePlayerId =
          normalizeStablePlayerId(data.playerId) ?? normalizeStablePlayerId(socket.data.playerId);
        const joinToken = normalizeJoinToken(data.joinToken, socket.data.joinToken);
        const providedResumeToken =
          typeof data.resumeToken === 'string' ? data.resumeToken : undefined;

        const authorization = authorizePartyJoin(sessionId, stablePlayerId, joinToken);
        if (!authorization.ok) {
          socketLogger.warn(
            { sessionId, playerId: stablePlayerId, reason: authorization.reason },
            'autoJoinRoom rejected: unauthorized scout party member'
          );
          return respond({ ok: false, error: authorization.error });
        }

        const authorizedPlayerId = authorization.member.playerId;
        const name = authorization.member.name;
        const isPartyHost = authorization.isHost;
        const roomCode = getSessionRoom(sessionId);
        const existingRoom = roomCode ? getRoom(roomCode) : undefined;

        if (existingRoom) {
          const reconnectPlayerId = authorizedPlayerId;

          if (existingRoom.players[reconnectPlayerId]) {
            const player = existingRoom.players[reconnectPlayerId];
            if (providedResumeToken && player.resumeToken !== providedResumeToken) {
              socketLogger.warn(
                { roomCode: existingRoom.code, playerId: player.id, sessionId },
                'autoJoinRoom rejected: invalid scout resume token'
              );
              return respond({ ok: false, error: 'Invalid resume token' });
            }
            if (!providedResumeToken && player.resumeToken) {
              socketLogger.warn(
                { roomCode: existingRoom.code, playerId: player.id, sessionId },
                'autoJoinRoom rejected: scout resume token required'
              );
              return respond({ ok: false, error: 'Resume token required' });
            }
            bindPlayerToSocket(nsp, socket, existingRoom, reconnectPlayerId);
            syncRoomHostAfterJoin(existingRoom, authorization.hostPlayerId);
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
            (p) => p.id !== authorizedPlayerId && p.name.toLowerCase() === name.toLowerCase()
          );
          if (nameExists) return respond({ ok: false, error: 'Name already taken' });
          if (existingRoom.phase !== 'lobby') {
            return respond({ ok: false, error: 'Game already started' });
          }
          if (existingRoom.playerOrder.length >= MAX_PLAYERS) {
            return respond({ ok: false, error: 'Room is full' });
          }

          const player = createPlayer(name, isPartyHost, authorizedPlayerId);
          existingRoom.players[player.id] = player;
          existingRoom.playerOrder.push(player.id);
          bindPlayerToSocket(nsp, socket, existingRoom, player.id);
          syncRoomHostAfterJoin(existingRoom, authorization.hostPlayerId);
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

        const { room, hostId, resumeToken } = createRoom(name, socket.id, authorizedPlayerId);
        setSessionToRoom(sessionId, room.code);
        clearRoomCleanup(room.code);
        socket.join(room.code);
        syncRoomHostFromParty(room, authorization.hostPlayerId);
        broadcastRoom(nsp, room);
        socketLogger.info(
          { roomCode: room.code, playerId: hostId, sessionId },
          'created scout room'
        );
        return respond({ ok: true, roomCode: room.code, playerId: hostId, resumeToken });
      } catch (err) {
        instrumentation.finishError();
        return respond({ ok: false, error: callbackErrorMessage(err) });
      }
    });

    socket.on('startGame', (data: unknown, cb: unknown) => {
      const instrumentation = startSocketHandlerInstrumentation(namespace, 'startGame', gameId);
      const respond: (result: BasicResponse) => void =
        typeof cb === 'function'
          ? instrumentation.wrapCallback(cb as (result: BasicResponse) => void)
          : () => {};
      try {
        if (!isObjectPayload(data)) return respond({ ok: false, error: INVALID_REQUEST_ERROR });
        const roomCode = normalizeRequiredString(data.roomCode);
        if (!roomCode) return respond({ ok: false, error: INVALID_REQUEST_ERROR });

        const room = getRoom(roomCode);
        if (!room) return respond({ ok: false, error: 'Room not found' });
        if (!verifyIsHost(socket, room))
          return respond({ ok: false, error: 'Only host can start' });
        if (room.phase !== 'lobby') return respond({ ok: false, error: 'Game already started' });
        const lobbyPlayers = room.playerOrder.map((playerId) => room.players[playerId]);
        const disconnectedPlayers = lobbyPlayers.filter((player) => !player?.connected);
        if (disconnectedPlayers.length > 0) {
          return respond({ ok: false, error: 'All players must be connected to start' });
        }
        const connectedPlayers = lobbyPlayers.filter((player) => player?.connected);
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
        return respond({ ok: false, error: callbackErrorMessage(err) });
      }
    });

    socket.on('flipRow', (data: unknown, cb: unknown) => {
      const instrumentation = startSocketHandlerInstrumentation(namespace, 'flipRow', gameId);
      const respond: (result: BasicResponse) => void =
        typeof cb === 'function'
          ? instrumentation.wrapCallback(cb as (result: BasicResponse) => void)
          : () => {};
      try {
        if (!isObjectPayload(data)) return respond({ ok: false, error: INVALID_REQUEST_ERROR });
        const roomCode = normalizeRequiredString(data.roomCode);
        const flip = data.flip;
        if (!roomCode || typeof flip !== 'boolean') {
          return respond({ ok: false, error: INVALID_REQUEST_ERROR });
        }

        const room = getRoom(roomCode);
        if (!room || room.phase !== 'playing')
          return respond({ ok: false, error: 'Room not found' });
        const playerId = verifyPlayerInRoom(socket, roomCode);
        if (!playerId) return respond({ ok: false, error: 'Not in room' });
        const player = room.players[playerId];
        if (flip) flipPlayerRow(player);
        else keepPlayerRow(player);
        beginFirstTrickIfReady(room);
        broadcastRoom(nsp, room);
        socketLogger.info(
          { roomCode: room.code, playerId, flipped: flip },
          'scout setup choice made'
        );
        return respond({ ok: true });
      } catch (err) {
        return respond({ ok: false, error: callbackErrorMessage(err) });
      }
    });

    socket.on('playCards', (data: unknown, cb: unknown) => {
      const instrumentation = startSocketHandlerInstrumentation(namespace, 'playCards', gameId);
      const respond: (result: BasicResponse) => void =
        typeof cb === 'function'
          ? instrumentation.wrapCallback(cb as (result: BasicResponse) => void)
          : () => {};
      try {
        if (!isObjectPayload(data)) return respond({ ok: false, error: INVALID_REQUEST_ERROR });
        const roomCode = normalizeRequiredString(data.roomCode);
        const startIndex = data.startIndex;
        const count = data.count;
        if (
          !roomCode ||
          typeof startIndex !== 'number' ||
          typeof count !== 'number' ||
          !Number.isInteger(startIndex) ||
          !Number.isInteger(count)
        ) {
          return respond({ ok: false, error: INVALID_REQUEST_ERROR });
        }

        const room = getRoom(roomCode);
        if (!room || room.phase !== 'playing')
          return respond({ ok: false, error: 'Room not found' });
        const playerId = verifyPlayerInRoom(socket, roomCode);
        if (!playerId) return respond({ ok: false, error: 'Not in room' });
        playCards(room, playerId, startIndex, count);
        broadcastRoom(nsp, room);
        const ended = (room.phase as Room['phase']) === 'ended';
        socketLogger.info({ roomCode: room.code, playerId, count, ended }, 'scout cards played');
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

    socket.on('pass', (data: unknown, cb: unknown) => {
      const instrumentation = startSocketHandlerInstrumentation(namespace, 'pass', gameId);
      const respond: (result: BasicResponse) => void =
        typeof cb === 'function'
          ? instrumentation.wrapCallback(cb as (result: BasicResponse) => void)
          : () => {};
      try {
        if (!isObjectPayload(data)) return respond({ ok: false, error: INVALID_REQUEST_ERROR });
        const roomCode = normalizeRequiredString(data.roomCode);
        const source = data.source;
        const side = data.side;
        if (!roomCode || !isScoutSource(source) || !isScoutSide(side)) {
          return respond({ ok: false, error: INVALID_REQUEST_ERROR });
        }
        const cardId = typeof data.cardId === 'string' ? data.cardId : undefined;
        const fromPlayerId = typeof data.fromPlayerId === 'string' ? data.fromPlayerId : undefined;

        const room = getRoom(roomCode);
        if (!room || room.phase !== 'playing')
          return respond({ ok: false, error: 'Room not found' });
        const playerId = verifyPlayerInRoom(socket, roomCode);
        if (!playerId) return respond({ ok: false, error: 'Not in room' });
        passAndScout(room, playerId, source, side, cardId, fromPlayerId);
        broadcastRoom(nsp, room);
        socketLogger.info({ roomCode: room.code, playerId, source, side }, 'scout player passed');
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

    socket.on('playAgain', (data: unknown, cb: unknown) => {
      const instrumentation = startSocketHandlerInstrumentation(namespace, 'playAgain', gameId);
      const respond: (result: BasicResponse) => void =
        typeof cb === 'function'
          ? instrumentation.wrapCallback(cb as (result: BasicResponse) => void)
          : () => {};
      try {
        if (!isObjectPayload(data)) return respond({ ok: false, error: INVALID_REQUEST_ERROR });
        const roomCode = normalizeRequiredString(data.roomCode);
        if (!roomCode) return respond({ ok: false, error: INVALID_REQUEST_ERROR });

        const room = getRoom(roomCode);
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
        return respond({ ok: false, error: callbackErrorMessage(err) });
      }
    });

    socket.on('requestState', (data: unknown, cb: unknown) => {
      const instrumentation = startSocketHandlerInstrumentation(namespace, 'requestState', gameId);
      const respond: (result: BasicResponse) => void =
        typeof cb === 'function'
          ? instrumentation.wrapCallback(cb as (result: BasicResponse) => void)
          : () => {};
      try {
        if (!isObjectPayload(data)) return respond({ ok: false, error: INVALID_REQUEST_ERROR });
        const roomCode = normalizeRequiredString(data.roomCode);
        if (!roomCode) return respond({ ok: false, error: INVALID_REQUEST_ERROR });

        const room = getRoom(roomCode);
        if (!room) {
          return respond({ ok: false, error: 'Room not found' });
        }
        const playerId = verifyPlayerInRoom(socket, roomCode);
        if (!playerId) {
          return respond({ ok: false, error: 'Not in room' });
        }
        sendRoomToPlayer(nsp, room, playerId);
        return respond({ ok: true });
      } catch (err) {
        instrumentation.finishError();
        return respond({ ok: false, error: callbackErrorMessage(err) });
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

            if (wasHost && !syncRoomHostFromActiveParty(room, gameId)) {
              const remaining = room.playerOrder.map((id) => room.players[id]);
              const newHost =
                remaining.find((p) => p.id !== index.playerId && p.connected) ??
                remaining.find((p) => p.id !== index.playerId);
              if (newHost) assignHost(room, newHost.id);
              else clearHost(room);
            }

            if (room.phase === 'playing') {
              handlePlayerDisconnected(room);
            }

            broadcastRoom(nsp, room);
            const allDisconnected = Object.values(room.players).every((p) => !p.connected);
            if (room.phase === 'ended') scheduleRoomCleanup(room.code, ROOM_ENDED_CLEANUP_MS);
            else if (allDisconnected) scheduleRoomCleanup(room.code, ROOM_IDLE_TIMEOUT_MS);
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
        socketLogger.error({ err }, 'failed to handle scout disconnect');
      }
    });
  });
}
