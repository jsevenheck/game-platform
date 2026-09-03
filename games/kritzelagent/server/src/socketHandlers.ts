import type { Namespace, Server, Socket } from 'socket.io';
import { getPartyByActiveMatch } from '../../../../apps/platform/server/party/partyStore';
import {
  authorizePartyJoin,
  normalizeJoinToken,
  normalizeStablePlayerId,
  restoreHostToFirstConnectedPlayer,
  syncRoomHostAfterJoin,
  syncRoomHostFromParty,
  type GameRoomLike,
} from '../../../../apps/platform/server/party/gameAuth';
import {
  attachSocketEventDebugLogging,
  createSocketLogger,
} from '../../../../apps/platform/server/logging/socketLogger';
import {
  readLoggingConfig,
  createComponentLogger,
} from '../../../../apps/platform/server/logging/logger';
import { startSocketHandlerInstrumentation } from '../../../../apps/platform/server/observability/socketHandlerMetrics';
import {
  recordNamespaceConnection,
  recordNamespaceDisconnect,
} from '../../../../apps/platform/server/observability/socketNamespaceMetrics';
import { ROOM_IDLE_TIMEOUT_MS } from '../../core/src/constants';
import type { ClientToServerEvents, ServerToClientEvents } from '../../core/src/events';
import type { ServerRoom } from '../../core/src/types';
import {
  attachPlayerToRoom,
  clearRoomCleanup,
  createRoom,
  findPlayer,
  getRoomByCode,
  getRoomBySession,
  RoomFullError,
  scheduleRoomCleanup,
} from './models/room';
import { clearSocketIndex, getSocketIndex, setSocketIndex } from './models/player';
import { broadcastRoom } from './managers/broadcastManager';
import {
  KritzelagentError,
  nextRound,
  recheckAfterDisconnect,
  restartGame,
  startGame,
  submitAgentGuess,
  submitStroke,
  submitVote,
} from './managers/roundManager';

type KritzelagentSocket = Socket<ClientToServerEvents, ServerToClientEvents>;
type KritzelagentNamespace = Namespace<ClientToServerEvents, ServerToClientEvents>;

const GAME_ID = 'kritzelagent';
const INVALID_REQUEST_ERROR = 'Invalid request';

type ActionResponse = { ok: true } | { ok: false; error: string };

function isObjectPayload(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requiredString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized ? normalized : null;
}

function asGameRoomLike(room: ServerRoom): GameRoomLike {
  const players: GameRoomLike['players'] = {};
  for (const player of room.players) {
    players[player.id] = { id: player.id, connected: player.connected, isHost: player.isHost };
  }
  return {
    code: room.roomCode,
    ownerId: room.hostPlayerId,
    hostId: room.hostPlayerId,
    players,
  };
}

function applyHostSync(room: ServerRoom, gameRoom: GameRoomLike): void {
  room.hostPlayerId = gameRoom.hostId ?? room.hostPlayerId;
  for (const player of room.players) {
    player.isHost = gameRoom.players[player.id]?.isHost ?? false;
  }
}

function syncHostAfterJoin(room: ServerRoom, partyHostId: string, allowFallback: boolean): void {
  const gameRoom = asGameRoomLike(room);
  syncRoomHostAfterJoin(gameRoom, partyHostId, allowFallback);
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

function createResponder<T extends { ok?: boolean }>(
  instrumentation: ReturnType<typeof startSocketHandlerInstrumentation>,
  callback: unknown
): (result: T) => void {
  const cb = typeof callback === 'function' ? (callback as (result: T) => void) : () => {};
  return instrumentation.wrapCallback(cb);
}

function findPlayerBySocket(socket: KritzelagentSocket, room: ServerRoom): string | null {
  return room.players.find((player) => player.socketId === socket.id)?.id ?? null;
}

function broadcastGameRoom(nsp: KritzelagentNamespace, room: ServerRoom): void {
  broadcastRoom(nsp, room);
}

function applyDisconnectLifecycle(
  nsp: KritzelagentNamespace,
  socket: KritzelagentSocket,
  room: ServerRoom,
  playerId: string
): void {
  const player = findPlayer(room, playerId);
  if (!player || player.socketId !== socket.id) return;
  player.connected = false;
  player.socketId = '';
  clearSocketIndex(socket.id);
  socket.leave(room.roomCode);
  recheckAfterDisconnect(room);

  if (player.isHost || !hasConnectedGameHost(room)) {
    if (!syncHostFromActiveParty(room)) restoreFallbackHost(room);
  }
  broadcastGameRoom(nsp, room);
  if (!room.players.some((candidate) => candidate.connected)) {
    scheduleRoomCleanup(room.roomCode, ROOM_IDLE_TIMEOUT_MS);
  }
}

function bindPlayerToSocket(
  nsp: KritzelagentNamespace,
  socket: KritzelagentSocket,
  room: ServerRoom,
  playerId: string
): void {
  const player = findPlayer(room, playerId);
  if (!player) return;

  if (player.socketId && player.socketId !== socket.id) {
    clearSocketIndex(player.socketId);
    nsp.sockets.get(player.socketId)?.disconnect(true);
  }

  const currentIndex = getSocketIndex(socket.id);
  if (
    currentIndex &&
    (currentIndex.roomCode !== room.roomCode || currentIndex.playerId !== playerId)
  ) {
    const previousRoom = getRoomByCode(currentIndex.roomCode);
    if (previousRoom) applyDisconnectLifecycle(nsp, socket, previousRoom, currentIndex.playerId);
    else clearSocketIndex(socket.id);
  }

  player.socketId = socket.id;
  player.connected = true;
  setSocketIndex(socket.id, room.roomCode, player.id);
  clearRoomCleanup(room.roomCode);
  socket.join(room.roomCode);
}

function authorizeBoundPlayer(
  nsp: KritzelagentNamespace,
  socket: KritzelagentSocket,
  room: ServerRoom
): { ok: true; playerId: string } | { ok: false; error: string } {
  const playerId = findPlayerBySocket(socket, room);
  if (!playerId) return { ok: false, error: 'Not in room' };
  const joinToken = normalizeJoinToken(undefined, socket.data.joinToken);
  const authorization = authorizePartyJoin(GAME_ID, room.matchKey, playerId, joinToken);
  if (!authorization.ok) {
    applyDisconnectLifecycle(nsp, socket, room, playerId);
    return { ok: false, error: 'Not authorized for this match' };
  }
  const previousHostId = room.hostPlayerId;
  syncHostFromActiveParty(room);
  if (previousHostId !== room.hostPlayerId) broadcastGameRoom(nsp, room);
  return { ok: true, playerId };
}

function authorizeHost(
  nsp: KritzelagentNamespace,
  socket: KritzelagentSocket,
  room: ServerRoom
): { ok: true; playerId: string } | { ok: false; error: string } {
  const authorization = authorizeBoundPlayer(nsp, socket, room);
  if (!authorization.ok) return authorization;
  const player = findPlayer(room, authorization.playerId);
  if (!player?.connected || player.id !== room.hostPlayerId) {
    return { ok: false, error: 'Only host' };
  }
  return authorization;
}

export function registerKritzelagent(
  io: Server,
  namespace = `/g/${GAME_ID}`,
  gameLogger = createComponentLogger('game-server', { gameId: GAME_ID })
): void {
  const nsp = io.of(namespace) as KritzelagentNamespace;
  nsp.use((socket, next) => {
    const auth = socket.handshake.auth ?? {};
    socket.data.sessionId = auth.sessionId;
    socket.data.playerId = auth.playerId;
    socket.data.joinToken = auth.joinToken ?? auth.token;
    next();
  });

  nsp.on('connection', (socket: KritzelagentSocket) => {
    const socketLogger = createSocketLogger(gameLogger, socket);
    attachSocketEventDebugLogging(socket, socketLogger, readLoggingConfig().socketEvents);
    recordNamespaceConnection({ namespace, gameId: GAME_ID }, nsp);

    socket.on('autoJoinRoom', (data: unknown, callback: unknown) => {
      const instrumentation = startSocketHandlerInstrumentation(namespace, 'autoJoinRoom', GAME_ID);
      const respond = createResponder<
        | { ok: true; roomCode: string; playerId: string; resumeToken: string }
        | { ok: false; error: string }
      >(instrumentation, callback);
      try {
        if (!isObjectPayload(data)) return respond({ ok: false, error: INVALID_REQUEST_ERROR });
        const sessionId = requiredString(data.sessionId);
        if (!sessionId) return respond({ ok: false, error: INVALID_REQUEST_ERROR });
        const stablePlayerId =
          normalizeStablePlayerId(data.playerId) ?? normalizeStablePlayerId(socket.data.playerId);
        const joinToken = normalizeJoinToken(data.joinToken, socket.data.joinToken);
        const providedResumeToken =
          typeof data.resumeToken === 'string' ? data.resumeToken : undefined;
        const authorization = authorizePartyJoin(GAME_ID, sessionId, stablePlayerId, joinToken);
        if (!authorization.ok) return respond({ ok: false, error: authorization.error });

        const authorizedPlayerId = authorization.member.playerId;
        const name = authorization.member.name;
        socket.data.sessionId = sessionId;
        socket.data.playerId = authorizedPlayerId;
        socket.data.joinToken = joinToken;
        let room = getRoomBySession(sessionId);

        if (!room) {
          room = createRoom(name, { matchKey: sessionId, hostPlayerId: authorizedPlayerId });
          bindPlayerToSocket(nsp, socket, room, authorizedPlayerId);
          syncHostAfterJoin(room, authorization.hostPlayerId, !authorization.hostConnected);
          broadcastGameRoom(nsp, room);
          socketLogger.info(
            { roomCode: room.roomCode, playerId: authorizedPlayerId },
            'kritzelagent room created'
          );
          return respond({
            ok: true,
            roomCode: room.roomCode,
            playerId: authorizedPlayerId,
            resumeToken: room.players[0]!.resumeToken,
          });
        }

        const existing = room.players.find((player) => player.id === authorizedPlayerId);
        if (existing) {
          if (!providedResumeToken && existing.resumeToken) {
            return respond({ ok: false, error: 'Resume token required' });
          }
          if (providedResumeToken !== existing.resumeToken) {
            return respond({ ok: false, error: 'Invalid resume token' });
          }
          bindPlayerToSocket(nsp, socket, room, existing.id);
          syncHostAfterJoin(room, authorization.hostPlayerId, !authorization.hostConnected);
          broadcastGameRoom(nsp, room);
          return respond({
            ok: true,
            roomCode: room.roomCode,
            playerId: existing.id,
            resumeToken: existing.resumeToken,
          });
        }

        if (room.phase !== 'lobby') return respond({ ok: false, error: 'Game already started' });
        if (room.players.some((player) => player.name.toLowerCase() === name.toLowerCase())) {
          return respond({ ok: false, error: 'Name already taken' });
        }
        const joined = attachPlayerToRoom(room, name, authorizedPlayerId);
        bindPlayerToSocket(nsp, socket, room, joined.playerId);
        syncHostAfterJoin(room, authorization.hostPlayerId, !authorization.hostConnected);
        broadcastGameRoom(nsp, room);
        return respond({ ok: true, roomCode: room.roomCode, ...joined });
      } catch (error) {
        instrumentation.finishError();
        socketLogger.error({ err: error }, 'unexpected kritzelagent join failure');
        return respond({
          ok: false,
          error: error instanceof RoomFullError ? 'Room is full' : 'Action failed',
        });
      }
    });

    socket.on('syncAuthority', (data: unknown, callback: unknown) => {
      const instrumentation = startSocketHandlerInstrumentation(
        namespace,
        'syncAuthority',
        GAME_ID
      );
      const respond = createResponder<ActionResponse>(instrumentation, callback);
      try {
        if (!isObjectPayload(data)) return respond({ ok: false, error: INVALID_REQUEST_ERROR });
        const roomCode = requiredString(data.roomCode);
        if (!roomCode) return respond({ ok: false, error: INVALID_REQUEST_ERROR });
        const room = getRoomByCode(roomCode);
        if (!room) return respond({ ok: false, error: 'Room not found' });
        const authorization = authorizeBoundPlayer(nsp, socket, room);
        if (!authorization.ok) return respond(authorization);
        broadcastGameRoom(nsp, room);
        return respond({ ok: true });
      } catch (error) {
        instrumentation.finishError();
        socketLogger.error({ err: error }, 'kritzelagent authority sync failed');
        return respond({ ok: false, error: 'Action failed' });
      }
    });

    socket.on('startGame', (data: unknown, callback: unknown) => {
      const instrumentation = startSocketHandlerInstrumentation(namespace, 'startGame', GAME_ID);
      const respond = createResponder<ActionResponse>(instrumentation, callback);
      try {
        if (!isObjectPayload(data)) return respond({ ok: false, error: INVALID_REQUEST_ERROR });
        const roomCode = requiredString(data.roomCode);
        const room = roomCode ? getRoomByCode(roomCode) : undefined;
        if (!room) return respond({ ok: false, error: 'Room not found' });
        const authorization = authorizeHost(nsp, socket, room);
        if (!authorization.ok) {
          return respond({
            ok: false,
            error:
              authorization.error === 'Only host' ? 'Only host can start' : authorization.error,
          });
        }
        startGame(room);
        broadcastGameRoom(nsp, room);
        return respond({ ok: true });
      } catch (error) {
        if (error instanceof KritzelagentError) return respond({ ok: false, error: error.message });
        instrumentation.finishError();
        socketLogger.error({ err: error }, 'kritzelagent start failed');
        return respond({ ok: false, error: 'Action failed' });
      }
    });

    socket.on('submitStroke', (data: unknown, callback: unknown) => {
      const instrumentation = startSocketHandlerInstrumentation(namespace, 'submitStroke', GAME_ID);
      const respond = createResponder<ActionResponse>(instrumentation, callback);
      try {
        if (!isObjectPayload(data)) return respond({ ok: false, error: INVALID_REQUEST_ERROR });
        const roomCode = requiredString(data.roomCode);
        const room = roomCode ? getRoomByCode(roomCode) : undefined;
        if (!room) return respond({ ok: false, error: 'Room not found' });
        const authorization = authorizeBoundPlayer(nsp, socket, room);
        if (!authorization.ok) return respond(authorization);
        submitStroke(room, authorization.playerId, data.points);
        broadcastGameRoom(nsp, room);
        return respond({ ok: true });
      } catch (error) {
        if (error instanceof KritzelagentError) return respond({ ok: false, error: error.message });
        instrumentation.finishError();
        socketLogger.error({ err: error }, 'kritzelagent stroke failed');
        return respond({ ok: false, error: 'Action failed' });
      }
    });

    socket.on('submitVote', (data: unknown, callback: unknown) => {
      const instrumentation = startSocketHandlerInstrumentation(namespace, 'submitVote', GAME_ID);
      const respond = createResponder<ActionResponse>(instrumentation, callback);
      try {
        if (!isObjectPayload(data)) return respond({ ok: false, error: INVALID_REQUEST_ERROR });
        const roomCode = requiredString(data.roomCode);
        const targetPlayerId = requiredString(data.targetPlayerId);
        const room = roomCode ? getRoomByCode(roomCode) : undefined;
        if (!room || !targetPlayerId)
          return respond({ ok: false, error: room ? INVALID_REQUEST_ERROR : 'Room not found' });
        const authorization = authorizeBoundPlayer(nsp, socket, room);
        if (!authorization.ok) return respond(authorization);
        submitVote(room, authorization.playerId, targetPlayerId);
        broadcastGameRoom(nsp, room);
        return respond({ ok: true });
      } catch (error) {
        if (error instanceof KritzelagentError) return respond({ ok: false, error: error.message });
        instrumentation.finishError();
        socketLogger.error({ err: error }, 'kritzelagent vote failed');
        return respond({ ok: false, error: 'Action failed' });
      }
    });

    socket.on('submitAgentGuess', (data: unknown, callback: unknown) => {
      const instrumentation = startSocketHandlerInstrumentation(
        namespace,
        'submitAgentGuess',
        GAME_ID
      );
      const respond = createResponder<ActionResponse>(instrumentation, callback);
      try {
        if (!isObjectPayload(data)) return respond({ ok: false, error: INVALID_REQUEST_ERROR });
        const roomCode = requiredString(data.roomCode);
        const guess = requiredString(data.guess);
        const room = roomCode ? getRoomByCode(roomCode) : undefined;
        if (!room || !guess)
          return respond({ ok: false, error: room ? INVALID_REQUEST_ERROR : 'Room not found' });
        const authorization = authorizeBoundPlayer(nsp, socket, room);
        if (!authorization.ok) return respond(authorization);
        submitAgentGuess(room, authorization.playerId, guess);
        broadcastGameRoom(nsp, room);
        return respond({ ok: true });
      } catch (error) {
        if (error instanceof KritzelagentError) return respond({ ok: false, error: error.message });
        instrumentation.finishError();
        socketLogger.error({ err: error }, 'kritzelagent agent guess failed');
        return respond({ ok: false, error: 'Action failed' });
      }
    });

    for (const [eventName, action] of [
      ['nextRound', nextRound],
      ['restartGame', restartGame],
    ] as const) {
      socket.on(eventName, (data: unknown, callback: unknown) => {
        const instrumentation = startSocketHandlerInstrumentation(namespace, eventName, GAME_ID);
        const respond = createResponder<ActionResponse>(instrumentation, callback);
        try {
          if (!isObjectPayload(data)) return respond({ ok: false, error: INVALID_REQUEST_ERROR });
          const roomCode = requiredString(data.roomCode);
          const room = roomCode ? getRoomByCode(roomCode) : undefined;
          if (!room) return respond({ ok: false, error: 'Room not found' });
          const authorization = authorizeHost(nsp, socket, room);
          if (!authorization.ok) {
            return respond({
              ok: false,
              error:
                authorization.error === 'Only host' ? 'Only host can act' : authorization.error,
            });
          }
          action(room);
          broadcastGameRoom(nsp, room);
          return respond({ ok: true });
        } catch (error) {
          if (error instanceof KritzelagentError)
            return respond({ ok: false, error: error.message });
          instrumentation.finishError();
          socketLogger.error({ err: error }, `kritzelagent ${eventName} failed`);
          return respond({ ok: false, error: 'Action failed' });
        }
      });
    }

    socket.on('disconnect', () => {
      recordNamespaceDisconnect({ namespace, gameId: GAME_ID }, nsp);
      const index = getSocketIndex(socket.id);
      if (!index) return;
      const room = getRoomByCode(index.roomCode);
      if (room) applyDisconnectLifecycle(nsp, socket, room, index.playerId);
      else clearSocketIndex(socket.id);
    });
  });
}
