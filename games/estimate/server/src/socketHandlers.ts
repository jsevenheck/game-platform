import type { Namespace, Server, Socket } from 'socket.io';
import type { Logger } from 'pino';
import {
  authorizePartyJoin,
  normalizeJoinToken,
  normalizeStablePlayerId,
  syncRoomHostAfterJoin,
  type GameRoomLike,
} from '../../../../apps/platform/server/party/gameAuth';
import {
  attachSocketEventDebugLogging,
  createSocketLogger,
} from '../../../../apps/platform/server/logging/socketLogger';
import { readLoggingConfig } from '../../../../apps/platform/server/logging/logger';
import { startSocketHandlerInstrumentation } from '../../../../apps/platform/server/observability/socketHandlerMetrics';
import {
  recordNamespaceConnection,
  recordNamespaceDisconnect,
} from '../../../../apps/platform/server/observability/socketNamespaceMetrics';
import {
  __listRoomsForTests,
  __resetRoomStoreForTests,
  attachPlayerToRoom,
  createRoom,
  findPlayer,
  getRoomByCode,
  getRoomBySession,
  RoomFullError,
} from './models/room';
import { clearSocketIndex, setSocketIndex } from './models/player';
import { buildRoomView } from './managers/broadcastManager';
import {
  nextRound,
  restartGame,
  revealSolution,
  startGame as startRound,
  submitGuess,
  isFiniteGuess,
  EstimateError,
} from './managers/roundManager';
import type { ServerRoom } from '../../core/src/types';
import type { ClientToServerEvents, ServerToClientEvents } from '../../core/src/events';

type EstimateSocket = Socket<ClientToServerEvents, ServerToClientEvents>;
type EstimateNamespace = Namespace<ClientToServerEvents, ServerToClientEvents>;

const GAME_ID = 'estimate';
const INVALID_REQUEST_ERROR = 'Invalid request';

function isObjectPayload(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeRequiredString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function callbackErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Invalid action';
}

/** Adapter that exposes a ServerRoom (array-based) as a GameRoomLike (record-based)
 *  so we can reuse the platform party host-sync helpers. */
function asGameRoomLike(room: ServerRoom): GameRoomLike {
  const playersRecord: GameRoomLike['players'] = {};
  for (const p of room.players) {
    playersRecord[p.id] = { id: p.id, connected: p.connected, isHost: p.isHost };
  }
  return {
    code: room.roomCode,
    ownerId: room.hostPlayerId,
    hostId: room.hostPlayerId,
    players: playersRecord,
  };
}

function createInstrumentedResponder<T extends { ok?: boolean }>(
  instrumentation: ReturnType<typeof startSocketHandlerInstrumentation>,
  cb: unknown
): (result: T) => void {
  const callback = typeof cb === 'function' ? (cb as (result: T) => void) : () => {};
  return instrumentation.wrapCallback(callback);
}

function broadcastRoom(nsp: EstimateNamespace, room: ServerRoom): void {
  const view = buildRoomView(room);
  nsp.to(room.roomCode).emit('roomUpdate', view);
}

function findPlayerBySocket(socket: EstimateSocket, room: ServerRoom): string | null {
  const player = room.players.find((p) => p.socketId === socket.id);
  return player?.id ?? null;
}

function bindPlayerToSocket(
  nsp: EstimateNamespace,
  socket: EstimateSocket,
  room: ServerRoom,
  playerId: string
): void {
  const player = findPlayer(room, playerId);
  if (!player) return;

  // Disconnect any prior socket claiming the same player.
  for (const other of room.players) {
    if (other.id !== playerId && other.socketId === socket.id) {
      other.socketId = '';
      other.connected = false;
    }
  }

  player.socketId = socket.id;
  player.connected = true;
  setSocketIndex(socket.id, room.roomCode, player.id);
  socket.join(room.roomCode);
}

function findRoomBySocketId(socketId: string): ServerRoom | undefined {
  return listAllRooms().find((r) => r.players.some((p) => p.socketId === socketId));
}

function listAllRooms(): ServerRoom[] {
  return __listRoomsForTests();
}

function isHost(socket: EstimateSocket, room: ServerRoom): boolean {
  const playerId = findPlayerBySocket(socket, room);
  if (!playerId) return false;
  const player = findPlayer(room, playerId);
  return player?.isHost === true && player.connected === true;
}

function verifyPlayerInRoom(socket: EstimateSocket, room: ServerRoom): string | null {
  return findPlayerBySocket(socket, room);
}

function registerGameHandlers(
  nsp: EstimateNamespace,
  gameId: string,
  namespace: string,
  gameLogger: Logger
): void {
  nsp.on('connection', (socket: EstimateSocket) => {
    const socketLogger = createSocketLogger(gameLogger, socket);
    attachSocketEventDebugLogging(socket, socketLogger, readLoggingConfig().socketEvents);
    recordNamespaceConnection({ namespace, gameId }, nsp);

    socketLogger.debug('estimate client connected');

    socket.on('autoJoinRoom', (data: unknown, cb: unknown) => {
      const instrumentation = startSocketHandlerInstrumentation(namespace, 'autoJoinRoom', gameId);
      const respond = createInstrumentedResponder<
        | {
            ok: true;
            roomCode: string;
            playerId: string;
            resumeToken: string;
          }
        | { ok: false; error: string }
      >(instrumentation, cb);

      try {
        if (!isObjectPayload(data)) return respond({ ok: false, error: INVALID_REQUEST_ERROR });

        const sessionId = normalizeRequiredString(data.sessionId);
        if (!sessionId) return respond({ ok: false, error: INVALID_REQUEST_ERROR });

        const stablePlayerId =
          normalizeStablePlayerId(data.playerId) ?? normalizeStablePlayerId(socket.data.playerId);
        const joinToken = normalizeJoinToken(data.joinToken, socket.data.joinToken);
        const providedResumeToken =
          typeof data.resumeToken === 'string' ? data.resumeToken : undefined;

        const authorization = authorizePartyJoin(gameId, sessionId, stablePlayerId, joinToken);
        if (!authorization.ok) {
          socketLogger.warn(
            { sessionId, playerId: stablePlayerId, reason: authorization.reason },
            'autoJoinRoom rejected: unauthorized estimate party member'
          );
          return respond({ ok: false, error: authorization.error });
        }

        const authorizedPlayerId = authorization.member.playerId;
        const name = authorization.member.name;

        let room = getRoomBySession(sessionId);

        if (!room) {
          // First join: create a room for this session and add the joining
          // player with the platform-authoritative playerId so reconnects can
          // find them by id later.
          try {
            room = createRoom(name, {
              matchKey: sessionId,
              hostPlayerId: authorizedPlayerId,
            });
          } catch (err) {
            return respond({ ok: false, error: callbackErrorMessage(err) });
          }
          bindPlayerToSocket(nsp, socket, room, authorizedPlayerId);
          syncRoomHostAfterJoin(
            asGameRoomLike(room),
            authorization.hostPlayerId,
            !authorization.hostConnected
          );
          // Re-sync: the host sync helper mutated the GameRoomLike view but not
          // our original array. Re-apply the isHost flag back to the array.
          const gl = asGameRoomLike(room);
          for (const p of room.players) p.isHost = gl.players[p.id]?.isHost ?? false;
          if (gl.hostId) room.hostPlayerId = gl.hostId;

          broadcastRoom(nsp, room);
          socketLogger.info(
            {
              roomCode: room.roomCode,
              playerId: authorizedPlayerId,
              sessionId,
              created: true,
            },
            'estimate room created'
          );
          return respond({
            ok: true,
            roomCode: room.roomCode,
            playerId: authorizedPlayerId,
            resumeToken: room.players[0]!.resumeToken,
          });
        }

        // Room already exists: either rejoin existing player or join as new.
        const existing = room.players.find((p) => p.id === authorizedPlayerId);
        if (existing) {
          if (providedResumeToken && existing.resumeToken !== providedResumeToken) {
            return respond({ ok: false, error: 'Invalid resume token' });
          }
          if (!providedResumeToken && existing.resumeToken) {
            return respond({ ok: false, error: 'Resume token required' });
          }
          bindPlayerToSocket(nsp, socket, room, existing.id);
          syncRoomHostAfterJoin(
            asGameRoomLike(room),
            authorization.hostPlayerId,
            !authorization.hostConnected
          );
          const gl = asGameRoomLike(room);
          for (const p of room.players) p.isHost = gl.players[p.id]?.isHost ?? false;
          if (gl.hostId) room.hostPlayerId = gl.hostId;
          broadcastRoom(nsp, room);
          socketLogger.info(
            {
              roomCode: room.roomCode,
              playerId: existing.id,
              sessionId,
              resumed: true,
            },
            'player rejoined estimate room'
          );
          return respond({
            ok: true,
            roomCode: room.roomCode,
            playerId: existing.id,
            resumeToken: existing.resumeToken,
          });
        }

        // New player joining an existing room.
        if (room.phase !== 'lobby') {
          return respond({ ok: false, error: 'Game already started' });
        }
        const nameTaken = room.players.some(
          (p) => p.id !== authorizedPlayerId && p.name.toLowerCase() === name.toLowerCase()
        );
        if (nameTaken) return respond({ ok: false, error: 'Name already taken' });

        try {
          const { playerId, resumeToken } = attachPlayerToRoom(room, name, authorizedPlayerId);
          bindPlayerToSocket(nsp, socket, room, playerId);
          syncRoomHostAfterJoin(
            asGameRoomLike(room),
            authorization.hostPlayerId,
            !authorization.hostConnected
          );
          const gl = asGameRoomLike(room);
          for (const p of room.players) p.isHost = gl.players[p.id]?.isHost ?? false;
          if (gl.hostId) room.hostPlayerId = gl.hostId;
          broadcastRoom(nsp, room);
          socketLogger.info(
            { roomCode: room.roomCode, playerId, sessionId, resumed: false },
            'player joined estimate room'
          );
          return respond({ ok: true, roomCode: room.roomCode, playerId, resumeToken });
        } catch (err) {
          if (err instanceof RoomFullError) {
            return respond({ ok: false, error: 'Room is full' });
          }
          return respond({ ok: false, error: callbackErrorMessage(err) });
        }
      } catch (err) {
        instrumentation.finishError();
        return respond({ ok: false, error: callbackErrorMessage(err) });
      }
    });

    socket.on('startGame', (data: unknown, cb: unknown) => {
      const instrumentation = startSocketHandlerInstrumentation(namespace, 'startGame', gameId);
      const respond = createInstrumentedResponder<{ ok: true } | { ok: false; error: string }>(
        instrumentation,
        cb
      );
      try {
        if (!isObjectPayload(data)) return respond({ ok: false, error: INVALID_REQUEST_ERROR });
        const roomCode = normalizeRequiredString(data.roomCode);
        if (!roomCode) return respond({ ok: false, error: INVALID_REQUEST_ERROR });
        const room = getRoomByCode(roomCode);
        if (!room) return respond({ ok: false, error: 'Room not found' });
        if (!isHost(socket, room)) return respond({ ok: false, error: 'Only host can start' });
        if (room.phase !== 'lobby') return respond({ ok: false, error: 'Game already started' });

        startRound(room);
        broadcastRoom(nsp, room);
        socketLogger.info(
          { roomCode: room.roomCode, hostPlayerId: room.hostPlayerId },
          'estimate game started'
        );
        return respond({ ok: true });
      } catch (err) {
        instrumentation.finishError();
        if (err instanceof EstimateError) return respond({ ok: false, error: err.message });
        return respond({ ok: false, error: callbackErrorMessage(err) });
      }
    });

    socket.on('submitGuess', (data: unknown, cb: unknown) => {
      const instrumentation = startSocketHandlerInstrumentation(namespace, 'submitGuess', gameId);
      const respond = createInstrumentedResponder<{ ok: true } | { ok: false; error: string }>(
        instrumentation,
        cb
      );
      try {
        if (!isObjectPayload(data)) return respond({ ok: false, error: INVALID_REQUEST_ERROR });
        const roomCode = normalizeRequiredString(data.roomCode);
        if (!roomCode) return respond({ ok: false, error: INVALID_REQUEST_ERROR });
        const room = getRoomByCode(roomCode);
        if (!room) return respond({ ok: false, error: 'Room not found' });
        const playerId = verifyPlayerInRoom(socket, room);
        if (!playerId) return respond({ ok: false, error: 'Not in room' });
        if (!isFiniteGuess(data.guess)) return respond({ ok: false, error: 'Invalid guess' });

        submitGuess(room, playerId, data.guess);
        broadcastRoom(nsp, room);
        socketLogger.info(
          { roomCode: room.roomCode, playerId, phase: room.phase },
          'estimate guess submitted'
        );
        return respond({ ok: true });
      } catch (err) {
        instrumentation.finishError();
        if (err instanceof EstimateError) return respond({ ok: false, error: err.message });
        return respond({ ok: false, error: callbackErrorMessage(err) });
      }
    });

    socket.on('revealSolution', (data: unknown, cb: unknown) => {
      const instrumentation = startSocketHandlerInstrumentation(
        namespace,
        'revealSolution',
        gameId
      );
      const respond = createInstrumentedResponder<{ ok: true } | { ok: false; error: string }>(
        instrumentation,
        cb
      );
      try {
        if (!isObjectPayload(data)) return respond({ ok: false, error: INVALID_REQUEST_ERROR });
        const roomCode = normalizeRequiredString(data.roomCode);
        if (!roomCode) return respond({ ok: false, error: INVALID_REQUEST_ERROR });
        const room = getRoomByCode(roomCode);
        if (!room) return respond({ ok: false, error: 'Room not found' });
        if (!isHost(socket, room)) return respond({ ok: false, error: 'Only host can reveal' });
        revealSolution(room);
        broadcastRoom(nsp, room);
        socketLogger.info({ roomCode: room.roomCode }, 'estimate solution revealed');
        return respond({ ok: true });
      } catch (err) {
        instrumentation.finishError();
        if (err instanceof EstimateError) return respond({ ok: false, error: err.message });
        return respond({ ok: false, error: callbackErrorMessage(err) });
      }
    });

    socket.on('nextRound', (data: unknown, cb: unknown) => {
      const instrumentation = startSocketHandlerInstrumentation(namespace, 'nextRound', gameId);
      const respond = createInstrumentedResponder<{ ok: true } | { ok: false; error: string }>(
        instrumentation,
        cb
      );
      try {
        if (!isObjectPayload(data)) return respond({ ok: false, error: INVALID_REQUEST_ERROR });
        const roomCode = normalizeRequiredString(data.roomCode);
        if (!roomCode) return respond({ ok: false, error: INVALID_REQUEST_ERROR });
        const room = getRoomByCode(roomCode);
        if (!room) return respond({ ok: false, error: 'Room not found' });
        if (!isHost(socket, room)) return respond({ ok: false, error: 'Only host can advance' });
        nextRound(room);
        broadcastRoom(nsp, room);
        socketLogger.info(
          { roomCode: room.roomCode, currentRound: room.currentRound, phase: room.phase },
          'estimate round advanced'
        );
        return respond({ ok: true });
      } catch (err) {
        instrumentation.finishError();
        if (err instanceof EstimateError) return respond({ ok: false, error: err.message });
        return respond({ ok: false, error: callbackErrorMessage(err) });
      }
    });

    socket.on('restartGame', (data: unknown, cb: unknown) => {
      const instrumentation = startSocketHandlerInstrumentation(namespace, 'restartGame', gameId);
      const respond = createInstrumentedResponder<{ ok: true } | { ok: false; error: string }>(
        instrumentation,
        cb
      );
      try {
        if (!isObjectPayload(data)) return respond({ ok: false, error: INVALID_REQUEST_ERROR });
        const roomCode = normalizeRequiredString(data.roomCode);
        if (!roomCode) return respond({ ok: false, error: INVALID_REQUEST_ERROR });
        const room = getRoomByCode(roomCode);
        if (!room) return respond({ ok: false, error: 'Room not found' });
        if (!isHost(socket, room)) return respond({ ok: false, error: 'Only host can restart' });
        restartGame(room);
        broadcastRoom(nsp, room);
        socketLogger.info({ roomCode: room.roomCode }, 'estimate game restarted');
        return respond({ ok: true });
      } catch (err) {
        instrumentation.finishError();
        if (err instanceof EstimateError) return respond({ ok: false, error: err.message });
        return respond({ ok: false, error: callbackErrorMessage(err) });
      }
    });

    socket.on('disconnect', () => {
      recordNamespaceDisconnect({ namespace, gameId }, nsp);
      // Mark the player as disconnected; the room view will reflect this on
      // the next broadcast. We do not delete the player — they may rejoin.
      const room = findRoomBySocketId(socket.id);
      if (room) {
        const player = room.players.find((p) => p.socketId === socket.id);
        if (player) {
          player.connected = false;
          player.socketId = '';
          clearSocketIndex(socket.id);
          broadcastRoom(nsp, room);
        }
      }
      socketLogger.debug('estimate client disconnected');
    });
  });
}

export function registerEstimate(io: Server, namespace: string, gameLogger: Logger): void {
  const nsp = io.of(namespace) as unknown as EstimateNamespace;
  registerGameHandlers(nsp, GAME_ID, namespace, gameLogger);
}

/** Test-only: reset all in-memory state for unit tests. */
export function __resetEstimateForTests(): void {
  __resetRoomStoreForTests();
}
