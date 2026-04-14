import type { Server, Socket, Namespace } from 'socket.io';
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
  MIN_PLAYERS,
  MAX_TARGET_SCORE,
  MIN_TARGET_SCORE,
  ROUND_END_DISPLAY_MS,
  ROOM_IDLE_TIMEOUT_MS,
  ROOM_ENDED_CLEANUP_MS,
} from '../../core/src/constants';
import {
  createRoom,
  getRoom,
  setSessionToRoom,
  getSessionRoom,
  clearRoomCleanup,
  scheduleRoomCleanup,
} from './models/room';
import { createPlayer, setSocketIndex, getSocketIndex, deleteSocketIndex } from './models/player';
import { broadcastRoom, sendRoomToPlayer, broadcastActionResolved } from './managers/broadcastManager';
import {
  startRound,
  playerHit,
  playerStay,
  chooseActionTarget,
  computeWinners,
  popResolvedAction,
} from './managers/roundManager';
import {
  transitionToPlaying,
  transitionToRoundEnd,
  transitionToEnded,
  transitionToLobby,
} from './managers/phaseManager';

type Flip7Socket = Socket<ClientToServerEvents, ServerToClientEvents>;

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

function verifyIsHost(socket: Flip7Socket, room: Room): boolean {
  const index = getSocketIndex(socket.id);
  return index !== undefined && index.roomCode === room.code && index.playerId === room.hostId;
}

function verifyPlayerInRoom(socket: Flip7Socket, roomCode: string): string | null {
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
  socket: Flip7Socket,
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

export function registerFlip7(io: Server, namespace = '/g/flip7'): void {
  const gameId = 'flip7';
  const nsp = io.of(namespace);
  const gameLogger = createComponentLogger('game-server', { gameId, namespace });
  const socketEventDebugEnabled = readLoggingConfig().socketEvents;

  nsp.use((socket, next) => {
    const auth = socket.handshake.auth || {};
    socket.data.sessionId = auth.sessionId;
    socket.data.playerId = auth.playerId;
    next();
  });

  /** After finalizeRound, decide whether to continue or end the game. */
  function advanceAfterRound(roomCode: string): void {
    const room = getRoom(roomCode);
    if (!room) return;

    const winners = computeWinners(room);
    if (winners.length === 1) {
      transitionToEnded(room, winners);
      broadcastRoom(nsp, room);
      gameLogger.info({ roomCode, winnerIds: winners }, 'flip7 game ended — winner determined');
      scheduleRoomCleanup(roomCode, ROOM_ENDED_CLEANUP_MS);
      return;
    }

    // No clear winner yet (0 = nobody reached target, 2+ = tie) — play another round
    transitionToRoundEnd(room);
    broadcastRoom(nsp, room);

    setTimeout(() => {
      const r = getRoom(roomCode);
      if (!r || r.phase !== 'roundEnd') return;
      transitionToPlaying(r);
      startRound(r);
      broadcastRoom(nsp, r);
      gameLogger.info(
        { roomCode, roundNumber: r.currentRound?.roundNumber },
        'flip7 new round started'
      );
    }, ROUND_END_DISPLAY_MS);
  }

  nsp.on('connection', (socket: Flip7Socket) => {
    const socketLogger = createSocketLogger(gameLogger, socket);
    attachSocketEventDebugLogging(socket, socketLogger, socketEventDebugEnabled);
    socketLogger.debug('flip7 client connected');
    recordNamespaceConnection({ namespace, gameId }, nsp);

    // ── autoJoinRoom ──────────────────────────────────────────────────────────
    socket.on('autoJoinRoom', (data, cb) => {
      const instrumentation = startSocketHandlerInstrumentation(namespace, 'autoJoinRoom', gameId);
      const respond = instrumentation.wrapCallback(cb);
      try {
        const sessionId = data.sessionId?.trim();
        const name = data.name?.trim();
        const wantsHost = data.isHost === true;
        const stablePlayerId =
          normalizeStablePlayerId(data.playerId) ?? normalizeStablePlayerId(socket.data.playerId);

        if (!sessionId || !name) {
          return respond({ ok: false, error: 'Missing session info' });
        }

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
                'autoJoinRoom rejected: invalid flip7 resume token'
              );
              return respond({ ok: false, error: 'Invalid resume token' });
            }
            if (!data.resumeToken && player.resumeToken) {
              socketLogger.warn(
                { roomCode: existingRoom.code, playerId: player.id, sessionId },
                'autoJoinRoom rejected: flip7 resume token required'
              );
              return respond({ ok: false, error: 'Resume token required' });
            }
            bindPlayerToSocket(nsp, socket, existingRoom, reconnectPlayerId);
            if (wantsHost && existingRoom.hostId !== reconnectPlayerId) {
              assignHost(existingRoom, reconnectPlayerId);
            }
            if (wantsHost) existingRoom.ownerId = reconnectPlayerId;
            broadcastRoom(nsp, existingRoom);
            socketLogger.info(
              { roomCode: existingRoom.code, playerId: player.id, sessionId, resumed: true },
              'player rejoined flip7 room'
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

          const player = createPlayer(name, false, stablePlayerId ?? undefined);
          player.socketId = socket.id;
          existingRoom.players[player.id] = player;
          bindPlayerToSocket(nsp, socket, existingRoom, player.id);
          if (wantsHost) {
            assignHost(existingRoom, player.id);
            existingRoom.ownerId = player.id;
          }
          broadcastRoom(nsp, existingRoom);
          socketLogger.info(
            { roomCode: existingRoom.code, playerId: player.id, sessionId, resumed: false },
            'player joined existing flip7 room'
          );
          return respond({
            ok: true,
            roomCode: existingRoom.code,
            playerId: player.id,
            resumeToken: player.resumeToken,
          });
        }

        // Create a new room
        const { room, hostId, resumeToken } = createRoom(
          name,
          socket.id,
          stablePlayerId ?? undefined
        );
        setSessionToRoom(sessionId, room.code);
        clearRoomCleanup(room.code);
        socket.join(room.code);
        if (wantsHost && room.hostId !== hostId) {
          assignHost(room, hostId);
        }
        broadcastRoom(nsp, room);
        socketLogger.info(
          { roomCode: room.code, playerId: hostId, sessionId },
          'created flip7 room'
        );
        respond({ ok: true, roomCode: room.code, playerId: hostId, resumeToken });
      } catch (err) {
        instrumentation.finishError();
        throw err;
      }
    });

    // ── setTargetScore ────────────────────────────────────────────────────────
    socket.on('setTargetScore', (data) => {
      const room = getRoom(data.roomCode);
      if (!room || room.phase !== 'lobby') return;
      if (!verifyIsHost(socket, room)) return;

      const clamped = Math.min(MAX_TARGET_SCORE, Math.max(MIN_TARGET_SCORE, data.targetScore));
      room.targetScore = clamped;
      broadcastRoom(nsp, room);
    });

    // ── startGame ─────────────────────────────────────────────────────────────
    socket.on('startGame', (data, cb) => {
      const instrumentation = startSocketHandlerInstrumentation(namespace, 'startGame', gameId);
      const respond = instrumentation.wrapCallback(cb);
      try {
        const room = getRoom(data.roomCode);
        if (!room) return respond({ ok: false, error: 'Room not found' });
        if (!verifyIsHost(socket, room)) {
          socketLogger.warn(
            { roomCode: data.roomCode },
            'startGame rejected: actor is not flip7 host'
          );
          return respond({ ok: false, error: 'Only host can start' });
        }
        if (room.phase !== 'lobby') {
          return respond({ ok: false, error: 'Game already started' });
        }

        const connectedPlayers = Object.values(room.players).filter((p) => p.connected);
        if (connectedPlayers.length < MIN_PLAYERS) {
          return respond({ ok: false, error: `Need at least ${MIN_PLAYERS} players` });
        }

        transitionToPlaying(room);
        startRound(room);
        broadcastRoom(nsp, room);
        socketLogger.info(
          {
            roomCode: room.code,
            hostPlayerId: room.hostId,
            connectedPlayers: connectedPlayers.length,
          },
          'started flip7 game'
        );
        respond({ ok: true });
      } catch (err) {
        instrumentation.finishError();
        throw err;
      }
    });

    // ── hit ───────────────────────────────────────────────────────────────────
    socket.on('hit', (data) => {
      const room = getRoom(data.roomCode);
      if (!room || room.phase !== 'playing') return;
      const playerId = verifyPlayerInRoom(socket, data.roomCode);
      if (!playerId) return;

      playerHit(room, playerId);

      // Broadcast action announcement before room state (auto-resolve only).
      const resolved = popResolvedAction(data.roomCode);
      if (resolved) broadcastActionResolved(nsp, room, resolved);

      // roundManager already calls finalizeRound internally when round ends.
      // We only need to trigger the phase transition from here.
      if (room.currentRound?.roundEndReason) {
        broadcastRoom(nsp, room);
        advanceAfterRound(data.roomCode);
      } else {
        broadcastRoom(nsp, room);
      }
    });

    // ── stay ──────────────────────────────────────────────────────────────────
    socket.on('stay', (data) => {
      const room = getRoom(data.roomCode);
      if (!room || room.phase !== 'playing') return;
      const playerId = verifyPlayerInRoom(socket, data.roomCode);
      if (!playerId) return;

      playerStay(room, playerId);

      if (room.currentRound?.roundEndReason) {
        broadcastRoom(nsp, room);
        advanceAfterRound(data.roomCode);
      } else {
        broadcastRoom(nsp, room);
      }
    });

    // ── chooseActionTarget ────────────────────────────────────────────────────
    socket.on('chooseActionTarget', (data) => {
      const room = getRoom(data.roomCode);
      if (!room || room.phase !== 'playing') return;
      const playerId = verifyPlayerInRoom(socket, data.roomCode);
      if (!playerId) return;

      chooseActionTarget(room, playerId, data.targetPlayerId);

      // Broadcast action announcement before room state.
      const resolved = popResolvedAction(data.roomCode);
      if (resolved) broadcastActionResolved(nsp, room, resolved);

      if (room.currentRound?.roundEndReason) {
        broadcastRoom(nsp, room);
        advanceAfterRound(data.roomCode);
      } else {
        broadcastRoom(nsp, room);
      }
    });

    // ── playAgain ─────────────────────────────────────────────────────────────
    socket.on('playAgain', (data) => {
      const room = getRoom(data.roomCode);
      if (!room || room.phase !== 'ended') return;
      if (!verifyIsHost(socket, room)) return;

      transitionToLobby(room);
      broadcastRoom(nsp, room);
      socketLogger.info({ roomCode: room.code }, 'flip7 game restarted to lobby');
    });

    // ── requestState ──────────────────────────────────────────────────────────
    socket.on('requestState', (data) => {
      const room = getRoom(data.roomCode);
      if (!room) return;
      const playerId = verifyPlayerInRoom(socket, data.roomCode);
      if (!playerId) return;
      sendRoomToPlayer(nsp, room, playerId);
    });

    // ── disconnect ────────────────────────────────────────────────────────────
    socket.on('disconnect', (reason) => {
      const instrumentation = startSocketHandlerInstrumentation(namespace, 'disconnect');
      try {
        const index = getSocketIndex(socket.id);
        if (!index) {
          socketLogger.debug({ reason }, 'flip7 client disconnected before room binding');
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
              const remaining = Object.values(room.players);
              const newHost =
                remaining.find((p) => p.id !== index.playerId && p.connected) ??
                remaining.find((p) => p.id !== index.playerId);
              if (newHost) {
                assignHost(room, newHost.id);
              } else {
                room.hostId = null;
              }
            }

            broadcastRoom(nsp, room);

            const allDisconnected = Object.values(room.players).every((p) => !p.connected);
            if (allDisconnected) {
              scheduleRoomCleanup(room.code, ROOM_IDLE_TIMEOUT_MS);
              gameLogger.info(
                { roomCode: room.code },
                'scheduled flip7 room cleanup (all disconnected)'
              );
            }
          }
        }

        deleteSocketIndex(socket.id);
        socketLogger.info(
          { reason, roomCode: index.roomCode, playerId: index.playerId },
          'flip7 client disconnected'
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
