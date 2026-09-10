import type { Namespace, Server, Socket } from 'socket.io';
import type { Logger } from 'pino';
import { getPartyByActiveMatch } from '../../../../apps/platform/server/party/partyStore';
import {
  authorizePartyJoin,
  normalizeJoinToken,
  normalizeStablePlayerId,
  restoreHostToFirstConnectedPlayer,
  syncRoomHostFromParty,
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
  __resetRoomStoreForTests,
  attachPlayerToRoom,
  clearRoomCleanup,
  createRoom,
  findPlayer,
  getRoomByCode,
  getRoomBySession,
  scheduleRoomCleanup,
  RoomFullError,
} from './models/room';
import { clearSocketIndex, getSocketIndex, setSocketIndex } from './models/player';
import { buildRoomView } from './managers/broadcastManager';
import {
  nextRound,
  restartGame,
  revealAnswers,
  startGame as startRound,
  submitAnswer,
  allConnectedPlayersSubmitted,
  HerdMentalityError,
} from './managers/roundManager';
import { normalizeAnswer } from '../../core/src/rules';
import { ROOM_IDLE_TIMEOUT_MS } from '../../core/src/constants';
import type { ServerRoom } from '../../core/src/types';
import type { ClientToServerEvents, ServerToClientEvents } from '../../core/src/events';

type HerdMentalitySocket = Socket<ClientToServerEvents, ServerToClientEvents>;
type HerdMentalityNamespace = Namespace<ClientToServerEvents, ServerToClientEvents>;

const GAME_ID = 'herd-mentality';
const INVALID_REQUEST_ERROR = 'Invalid request';

function isObjectPayload(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeRequiredString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
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

function applyHostSync(room: ServerRoom, gameRoom: GameRoomLike): void {
  for (const player of room.players) {
    player.isHost = gameRoom.players[player.id]?.isHost ?? false;
  }
  if (gameRoom.hostId) room.hostPlayerId = gameRoom.hostId;
}

function syncHostAfterJoin(
  room: ServerRoom,
  hostPlayerId: string,
  allowFallbackHost: boolean
): void {
  const gameRoom = asGameRoomLike(room);
  syncRoomHostAfterJoin(gameRoom, hostPlayerId, allowFallbackHost);
  applyHostSync(room, gameRoom);
}

function syncHostFromActiveParty(room: ServerRoom): boolean {
  const party = getPartyByActiveMatch(room.matchKey, GAME_ID);
  if (!party) return false;

  const gameRoom = asGameRoomLike(room);
  syncRoomHostFromParty(gameRoom, party.hostPlayerId);
  applyHostSync(room, gameRoom);
  return true;
}

function restoreFallbackHost(room: ServerRoom): void {
  const gameRoom = asGameRoomLike(room);
  restoreHostToFirstConnectedPlayer(gameRoom);
  applyHostSync(room, gameRoom);
}

function hasConnectedGameHost(room: ServerRoom): boolean {
  return room.players.some((player) => player.id === room.hostPlayerId && player.connected);
}

function createInstrumentedResponder<T extends { ok?: boolean }>(
  instrumentation: ReturnType<typeof startSocketHandlerInstrumentation>,
  cb: unknown
): (result: T) => void {
  const callback = typeof cb === 'function' ? (cb as (result: T) => void) : () => {};
  return instrumentation.wrapCallback(callback);
}

function broadcastRoom(nsp: HerdMentalityNamespace, room: ServerRoom): void {
  const view = buildRoomView(room);
  nsp.to(room.roomCode).emit('roomUpdate', view);
  nsp.to(room.roomCode).emit('phaseChange', { phase: view.phase });
}

function findPlayerBySocket(socket: HerdMentalitySocket, room: ServerRoom): string | null {
  const player = room.players.find((p) => p.socketId === socket.id);
  return player?.id ?? null;
}

function applyDisconnectLifecycle(
  nsp: HerdMentalityNamespace,
  socket: HerdMentalitySocket,
  room: ServerRoom,
  playerId: string
): void {
  const player = findPlayer(room, playerId);
  if (!player || player.socketId !== socket.id) return;

  player.connected = false;
  player.socketId = '';
  clearSocketIndex(socket.id);
  socket.leave(room.roomCode);

  if (room.phase === 'answering' && allConnectedPlayersSubmitted(room)) {
    room.phase = 'allSubmitted';
  }
  if (player.isHost || !hasConnectedGameHost(room)) {
    if (!syncHostFromActiveParty(room)) restoreFallbackHost(room);
  }

  broadcastRoom(nsp, room);
  if (!room.players.some((candidate) => candidate.connected)) {
    scheduleRoomCleanup(room.roomCode, ROOM_IDLE_TIMEOUT_MS);
  }
}

function bindPlayerToSocket(
  nsp: HerdMentalityNamespace,
  socket: HerdMentalitySocket,
  room: ServerRoom,
  playerId: string
): void {
  const player = findPlayer(room, playerId);
  if (!player) return;

  if (player.socketId && player.socketId !== socket.id) {
    const previousSocketId = player.socketId;
    clearSocketIndex(previousSocketId);
    nsp.sockets.get(previousSocketId)?.disconnect(true);
  }

  const currentIndex = getSocketIndex(socket.id);
  if (
    currentIndex &&
    (currentIndex.roomCode !== room.roomCode || currentIndex.playerId !== playerId)
  ) {
    const previousRoom = getRoomByCode(currentIndex.roomCode);
    if (previousRoom) {
      applyDisconnectLifecycle(nsp, socket, previousRoom, currentIndex.playerId);
    } else {
      clearSocketIndex(socket.id);
    }
  }

  player.socketId = socket.id;
  player.connected = true;
  setSocketIndex(socket.id, room.roomCode, player.id);
  clearRoomCleanup(room.roomCode);
  socket.join(room.roomCode);
}

interface AuthorizedPlayer {
  ok: true;
  playerId: string;
}

interface UnauthorizedPlayer {
  ok: false;
  error: string;
}

function authorizeBoundPlayer(
  nsp: HerdMentalityNamespace,
  socket: HerdMentalitySocket,
  room: ServerRoom
): AuthorizedPlayer | UnauthorizedPlayer {
  const playerId = findPlayerBySocket(socket, room);
  if (!playerId) return { ok: false, error: 'Not in room' };

  const joinToken = normalizeJoinToken(undefined, socket.data.joinToken);
  const authorization = authorizePartyJoin(GAME_ID, room.matchKey, playerId, joinToken);
  if (!authorization.ok) {
    applyDisconnectLifecycle(nsp, socket, room, playerId);
    return { ok: false, error: 'Not authorized for this match' };
  }

  const previousHostPlayerId = room.hostPlayerId;
  syncHostFromActiveParty(room);
  if (previousHostPlayerId !== room.hostPlayerId) {
    broadcastRoom(nsp, room);
  }
  return { ok: true, playerId };
}

function authorizeHost(
  nsp: HerdMentalityNamespace,
  socket: HerdMentalitySocket,
  room: ServerRoom
): { ok: true } | UnauthorizedPlayer {
  const authorization = authorizeBoundPlayer(nsp, socket, room);
  if (!authorization.ok) return authorization;
  const player = findPlayer(room, authorization.playerId);
  if (player?.isHost !== true || player.connected !== true) {
    return { ok: false, error: 'Only host' };
  }
  return { ok: true };
}

function registerGameHandlers(
  nsp: HerdMentalityNamespace,
  gameId: string,
  namespace: string,
  gameLogger: Logger
): void {
  nsp.use((socket, next) => {
    const auth = socket.handshake.auth ?? {};
    socket.data.sessionId = auth.sessionId;
    socket.data.playerId = auth.playerId;
    socket.data.joinToken = auth.joinToken ?? auth.token;
    next();
  });

  nsp.on('connection', (socket: HerdMentalitySocket) => {
    const socketLogger = createSocketLogger(gameLogger, socket);
    attachSocketEventDebugLogging(socket, socketLogger, readLoggingConfig().socketEvents);
    recordNamespaceConnection({ namespace, gameId }, nsp);

    socketLogger.debug('herd-mentality client connected');

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
            'autoJoinRoom rejected: unauthorized herd-mentality party member'
          );
          return respond({ ok: false, error: authorization.error });
        }

        const authorizedPlayerId = authorization.member.playerId;
        const name = authorization.member.name;
        socket.data.sessionId = sessionId;
        socket.data.playerId = authorizedPlayerId;
        socket.data.joinToken = joinToken;

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
            instrumentation.finishError();
            socketLogger.error({ err, sessionId }, 'failed to create herd-mentality room');
            return respond({ ok: false, error: 'Action failed' });
          }
          bindPlayerToSocket(nsp, socket, room, authorizedPlayerId);
          // Build a single GameRoomLike view that syncRoomHostAfterJoin mutates
          // in-place, then re-apply the resulting isHost flags back to the
          // room's player array. Building a fresh view for the re-sync would
          // discard the helper's mutations.
          syncHostAfterJoin(room, authorization.hostPlayerId, !authorization.hostConnected);

          broadcastRoom(nsp, room);
          socketLogger.info(
            {
              roomCode: room.roomCode,
              playerId: authorizedPlayerId,
              sessionId,
              created: true,
            },
            'herd-mentality room created'
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
          syncHostAfterJoin(room, authorization.hostPlayerId, !authorization.hostConnected);
          if (room.phase === 'allSubmitted' && !room.answers.has(existing.id)) {
            room.phase = 'answering';
          }
          broadcastRoom(nsp, room);
          socketLogger.info(
            {
              roomCode: room.roomCode,
              playerId: existing.id,
              sessionId,
              resumed: true,
            },
            'player rejoined herd-mentality room'
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
          syncHostAfterJoin(room, authorization.hostPlayerId, !authorization.hostConnected);
          broadcastRoom(nsp, room);
          socketLogger.info(
            { roomCode: room.roomCode, playerId, sessionId, resumed: false },
            'player joined herd-mentality room'
          );
          return respond({ ok: true, roomCode: room.roomCode, playerId, resumeToken });
        } catch (err) {
          if (err instanceof RoomFullError) {
            return respond({ ok: false, error: 'Room is full' });
          }
          instrumentation.finishError();
          socketLogger.error({ err, sessionId }, 'failed to join herd-mentality room');
          return respond({ ok: false, error: 'Action failed' });
        }
      } catch (err) {
        instrumentation.finishError();
        socketLogger.error({ err }, 'unexpected autoJoinRoom failure');
        return respond({ ok: false, error: 'Action failed' });
      }
    });

    socket.on('syncAuthority', (data: unknown, cb: unknown) => {
      const instrumentation = startSocketHandlerInstrumentation(namespace, 'syncAuthority', gameId);
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
        const authorization = authorizeBoundPlayer(nsp, socket, room);
        if (!authorization.ok) return respond(authorization);
        broadcastRoom(nsp, room);
        return respond({ ok: true });
      } catch (err) {
        instrumentation.finishError();
        socketLogger.error({ err }, 'unexpected herd-mentality authority sync failure');
        return respond({ ok: false, error: 'Action failed' });
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
        const authorization = authorizeHost(nsp, socket, room);
        if (!authorization.ok) {
          return respond({
            ok: false,
            error:
              authorization.error === 'Only host' ? 'Only host can start' : authorization.error,
          });
        }
        if (room.phase !== 'lobby') return respond({ ok: false, error: 'Game already started' });

        startRound(room);
        broadcastRoom(nsp, room);
        socketLogger.info(
          { roomCode: room.roomCode, hostPlayerId: room.hostPlayerId },
          'herd-mentality game started'
        );
        return respond({ ok: true });
      } catch (err) {
        if (err instanceof HerdMentalityError) return respond({ ok: false, error: err.message });
        instrumentation.finishError();
        socketLogger.error({ err }, 'unexpected herd-mentality action failure');
        return respond({ ok: false, error: 'Action failed' });
      }
    });

    socket.on('submitAnswer', (data: unknown, cb: unknown) => {
      const instrumentation = startSocketHandlerInstrumentation(namespace, 'submitAnswer', gameId);
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
        const authorization = authorizeBoundPlayer(nsp, socket, room);
        if (!authorization.ok) return respond(authorization);
        if (!normalizeAnswer(data.answer)) return respond({ ok: false, error: 'Invalid answer' });

        submitAnswer(room, authorization.playerId, data.answer);
        broadcastRoom(nsp, room);
        socketLogger.info(
          { roomCode: room.roomCode, playerId: authorization.playerId, phase: room.phase },
          'herd-mentality answer submitted'
        );
        return respond({ ok: true });
      } catch (err) {
        if (err instanceof HerdMentalityError) return respond({ ok: false, error: err.message });
        instrumentation.finishError();
        socketLogger.error({ err }, 'unexpected herd-mentality action failure');
        return respond({ ok: false, error: 'Action failed' });
      }
    });

    socket.on('revealAnswers', (data: unknown, cb: unknown) => {
      const instrumentation = startSocketHandlerInstrumentation(namespace, 'revealAnswers', gameId);
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
        const authorization = authorizeHost(nsp, socket, room);
        if (!authorization.ok) {
          return respond({
            ok: false,
            error:
              authorization.error === 'Only host' ? 'Only host can reveal' : authorization.error,
          });
        }
        revealAnswers(room);
        broadcastRoom(nsp, room);
        socketLogger.info({ roomCode: room.roomCode }, 'herd-mentality solution revealed');
        return respond({ ok: true });
      } catch (err) {
        if (err instanceof HerdMentalityError) return respond({ ok: false, error: err.message });
        instrumentation.finishError();
        socketLogger.error({ err }, 'unexpected herd-mentality action failure');
        return respond({ ok: false, error: 'Action failed' });
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
        const authorization = authorizeHost(nsp, socket, room);
        if (!authorization.ok) {
          return respond({
            ok: false,
            error:
              authorization.error === 'Only host' ? 'Only host can advance' : authorization.error,
          });
        }
        nextRound(room);
        broadcastRoom(nsp, room);
        socketLogger.info(
          { roomCode: room.roomCode, currentRound: room.currentRound, phase: room.phase },
          'herd-mentality round advanced'
        );
        return respond({ ok: true });
      } catch (err) {
        if (err instanceof HerdMentalityError) return respond({ ok: false, error: err.message });
        instrumentation.finishError();
        socketLogger.error({ err }, 'unexpected herd-mentality action failure');
        return respond({ ok: false, error: 'Action failed' });
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
        const authorization = authorizeHost(nsp, socket, room);
        if (!authorization.ok) {
          return respond({
            ok: false,
            error:
              authorization.error === 'Only host' ? 'Only host can restart' : authorization.error,
          });
        }
        restartGame(room);
        broadcastRoom(nsp, room);
        socketLogger.info({ roomCode: room.roomCode }, 'herd-mentality game restarted');
        return respond({ ok: true });
      } catch (err) {
        if (err instanceof HerdMentalityError) return respond({ ok: false, error: err.message });
        instrumentation.finishError();
        socketLogger.error({ err }, 'unexpected herd-mentality action failure');
        return respond({ ok: false, error: 'Action failed' });
      }
    });

    socket.on('disconnect', () => {
      recordNamespaceDisconnect({ namespace, gameId }, nsp);
      // Mark the player as disconnected; the room view will reflect this on
      // the next broadcast. We do not delete the player — they may rejoin.
      const index = getSocketIndex(socket.id);
      const room = index ? getRoomByCode(index.roomCode) : undefined;
      if (room && index) {
        applyDisconnectLifecycle(nsp, socket, room, index.playerId);
        if (!room.players.some((candidate) => candidate.connected)) {
          socketLogger.info(
            { roomCode: room.roomCode, delayMs: ROOM_IDLE_TIMEOUT_MS },
            'scheduled abandoned herd-mentality room cleanup'
          );
        }
      }
      clearSocketIndex(socket.id);
      socketLogger.debug('herd-mentality client disconnected');
    });
  });
}

export function registerHerdMentality(io: Server, namespace: string, gameLogger: Logger): void {
  const nsp = io.of(namespace) as unknown as HerdMentalityNamespace;
  registerGameHandlers(nsp, GAME_ID, namespace, gameLogger);
}

/** Test-only: reset all in-memory state for unit tests. */
export function __resetHerdMentalityForTests(): void {
  __resetRoomStoreForTests();
}
