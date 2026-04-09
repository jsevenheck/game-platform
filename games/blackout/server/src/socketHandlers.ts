import type { Server, Socket, Namespace } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '../../core/src/events';
import type { Language, Room } from '../../core/src/types';
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
  recordSocketEventEnd,
  recordSocketEventStart,
  setNamespaceConnectionCount,
} from '../../../../apps/platform/server/metrics/metrics';
import {
  MIN_PLAYERS,
  MIN_ROUNDS,
  MAX_ROUNDS,
  ROUND_END_DISPLAY_MS,
  DEFAULT_EXCLUDED_LETTERS,
} from '../../core/src/constants';
import {
  createRoom,
  getRoom,
  setSessionToRoom,
  getSessionRoom,
  clearRoomCleanup,
  deleteRoom,
  scheduleRoomCleanup,
} from './models/room';
import { createPlayer, setSocketIndex, getSocketIndex, deleteSocketIndex } from './models/player';
import {
  transitionToPlaying,
  transitionToRoundEnd,
  transitionToEnded,
  transitionToLobby,
} from './managers/phaseManager';
import {
  startNewRound,
  revealCategory,
  rerollCurrentPrompt,
  selectWinner as selectRoundWinner,
  finalizeRound,
  getNextReader,
  getRandomReader,
  isLastRound,
} from './managers/roundManager';
import { addPoint, resetScores } from './managers/scoreManager';
import { broadcastRoom, sendRoomToPlayer } from './managers/broadcastManager';

type BlackoutSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

function isLanguage(value: string): value is Language {
  return value === 'de' || value === 'en';
}

function normalizeExcludedLetters(letters: string[]): string[] {
  const normalized = new Set<string>();
  for (const letter of letters) {
    const upper = letter.trim().toUpperCase();
    if (/^[A-Z]$/.test(upper)) {
      normalized.add(upper);
    }
  }
  const result = Array.from(normalized).sort();
  return result.length > 0 ? result : [...DEFAULT_EXCLUDED_LETTERS];
}

function assignHost(room: Room, newHostId: string): void {
  const nextHost = room.players[newHostId];
  if (!nextHost) return;

  if (room.hostId) {
    const currentHost = room.players[room.hostId];
    if (currentHost) {
      currentHost.isHost = false;
    }
  }

  room.hostId = newHostId;
  nextHost.isHost = true;
}

function verifyPlayer(socket: BlackoutSocket, roomCode: string, playerId: string): boolean {
  const index = getSocketIndex(socket.id);
  return index !== undefined && index.roomCode === roomCode && index.playerId === playerId;
}

function normalizeStablePlayerId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
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
  socket: BlackoutSocket,
  room: Room,
  playerId: string
): void {
  const player = room.players[playerId];
  if (!player) return;

  if (player.socketId && player.socketId !== socket.id) {
    const previousSocketId = player.socketId;
    detachIndexedSocket(nsp, previousSocketId);
    nsp.sockets.get(previousSocketId)?.disconnect(true);
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

export function registerBlackout(io: Server, namespace = '/g/blackout'): void {
  const gameId = 'blackout';
  const nsp = io.of(namespace);
  const gameLogger = createComponentLogger('game-server', { gameId, namespace });
  const socketEventDebugEnabled = readLoggingConfig().socketEvents;

  nsp.use((socket, next) => {
    const auth = socket.handshake.auth || {};
    socket.data.sessionId = auth.sessionId;
    socket.data.joinToken = auth.joinToken || auth.token;
    socket.data.playerId = auth.playerId;
    next();
  });

  function advanceRound(roomCode: string): void {
    const room = getRoom(roomCode);
    if (!room) return;

    finalizeRound(room);

    if (isLastRound(room)) {
      transitionToEnded(room);
      broadcastRoom(nsp, room);
      gameLogger.info({ roomCode }, 'room reached final round');
      return;
    }

    transitionToRoundEnd(room);
    broadcastRoom(nsp, room);

    // After scoreboard display, start next round
    setTimeout(() => {
      const room2 = getRoom(roomCode);
      if (!room2 || room2.phase !== 'roundEnd') return;

      const nextReader = getNextReader(room2);
      if (!nextReader) return;

      transitionToPlaying(room2);
      startNewRound(room2, nextReader);
      broadcastRoom(nsp, room2);
    }, ROUND_END_DISPLAY_MS);
  }

  nsp.on('connection', (socket: BlackoutSocket) => {
    const socketLogger = createSocketLogger(gameLogger, socket);

    attachSocketEventDebugLogging(socket, socketLogger, socketEventDebugEnabled);
    socketLogger.debug('game client connected');
    setNamespaceConnectionCount({ namespace, gameId }, nsp.sockets.size);
    recordSocketEventEnd(recordSocketEventStart({ namespace, event: 'connection', gameId }), {
      result: 'ok',
    });

    socket.on('autoJoinRoom', (data, cb) => {
      const instrumentation = startSocketHandlerInstrumentation(namespace, 'autoJoinRoom');
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

        // Check if session already mapped to a room
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
            // Require the server-issued resumeToken to prevent slot hijacking via public playerId.
            if (data.resumeToken && player.resumeToken !== data.resumeToken) {
              socketLogger.warn(
                { roomCode: existingRoom.code, playerId: player.id, sessionId },
                'autoJoinRoom rejected: invalid blackout resume token'
              );
              return respond({ ok: false, error: 'Invalid resume token' });
            }
            if (!data.resumeToken && player.resumeToken) {
              socketLogger.warn(
                { roomCode: existingRoom.code, playerId: player.id, sessionId },
                'autoJoinRoom rejected: blackout resume token required'
              );
              return respond({ ok: false, error: 'Resume token required' });
            }
            bindPlayerToSocket(nsp, socket, existingRoom, reconnectPlayerId);
            if (wantsHost && existingRoom.hostId !== reconnectPlayerId) {
              assignHost(existingRoom, reconnectPlayerId);
            }
            if (wantsHost) {
              existingRoom.ownerId = reconnectPlayerId;
            }
            broadcastRoom(nsp, existingRoom);
            socketLogger.info(
              {
                roomCode: existingRoom.code,
                playerId: player.id,
                sessionId,
                resumed: true,
              },
              'player rejoined blackout room'
            );
            return respond({
              ok: true,
              roomCode: existingRoom.code,
              playerId: player.id,
              resumeToken: player.resumeToken,
            });
          }

          const nameExists = Object.values(existingRoom.players).some(
            (player) =>
              player.id !== stablePlayerId && player.name.toLowerCase() === name.toLowerCase()
          );
          if (nameExists) {
            return respond({ ok: false, error: 'Name already taken' });
          }

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
            {
              roomCode: existingRoom.code,
              playerId: player.id,
              sessionId,
              resumed: false,
            },
            'player joined existing blackout room'
          );

          return respond({
            ok: true,
            roomCode: existingRoom.code,
            playerId: player.id,
            resumeToken: player.resumeToken,
          });
        }

        // Create a new room for this session
        const { room, hostId, resumeToken } = createRoom(
          name,
          socket.id,
          stablePlayerId ?? undefined
        );
        setSessionToRoom(sessionId, room.code);
        clearRoomCleanup(room.code);
        socket.join(room.code);
        broadcastRoom(nsp, room);

        socketLogger.info(
          {
            roomCode: room.code,
            playerId: hostId,
            sessionId,
          },
          'created blackout room'
        );

        respond({ ok: true, roomCode: room.code, playerId: hostId, resumeToken });
      } catch (err) {
        instrumentation.finishError();
        throw err;
      }
    });

    socket.on('resumePlayer', (data, cb) => {
      const instrumentation = startSocketHandlerInstrumentation(namespace, 'resumePlayer');
      const respond = instrumentation.wrapCallback(cb);
      try {
        const room = getRoom(data.roomCode);
        if (!room) {
          return respond({ ok: false, error: 'Room not found' });
        }

        const player = room.players[data.playerId];
        if (!player) {
          return respond({ ok: false, error: 'Player not found' });
        }
        if (player.resumeToken !== data.resumeToken) {
          socketLogger.warn(
            { roomCode: room.code, playerId: data.playerId },
            'resumePlayer rejected: invalid blackout resume token'
          );
          return respond({ ok: false, error: 'Invalid resume token' });
        }

        bindPlayerToSocket(nsp, socket, room, player.id);
        broadcastRoom(nsp, room);
        socketLogger.info(
          {
            roomCode: room.code,
            playerId: player.id,
          },
          'resumed blackout player'
        );
        respond({ ok: true });
      } catch (err) {
        instrumentation.finishError();
        throw err;
      }
    });

    socket.on('leaveRoom', (data) => {
      const instrumentation = startSocketHandlerInstrumentation(namespace, 'leaveRoom');
      try {
        const room = getRoom(data.roomCode);
        if (!room) {
          instrumentation.finishError();
          return;
        }

        const socketIdx = getSocketIndex(socket.id);
        const player = socketIdx ? room.players[socketIdx.playerId] : undefined;
        if (!player) {
          instrumentation.finishError();
          return;
        }

        delete room.players[player.id];
        deleteSocketIndex(socket.id);

        if (room.ownerId === player.id) {
          const remainingForOwner = Object.values(room.players);
          room.ownerId = remainingForOwner.length > 0 ? remainingForOwner[0].id : null;
        }

        // If host left, assign new host
        if (room.hostId === player.id) {
          const remaining = Object.values(room.players);
          const newHost = remaining[0];
          if (newHost) {
            newHost.isHost = true;
            room.hostId = newHost.id;
            if (room.currentRound) {
              room.currentRound.readerId = newHost.id;
            }
          } else {
            room.hostId = null;
          }
        }

        socket.leave(data.roomCode);

        if (Object.keys(room.players).length === 0) {
          deleteRoom(data.roomCode);
          socketLogger.info({ roomCode: data.roomCode }, 'deleted empty blackout room after leave');
          instrumentation.finishSuccess();
          return;
        }

        broadcastRoom(nsp, room);
        socketLogger.info(
          {
            roomCode: room.code,
            playerId: player.id,
            remainingPlayers: Object.keys(room.players).length,
          },
          'player left blackout room'
        );
        instrumentation.finishSuccess();
      } catch (err) {
        instrumentation.finishError();
        throw err;
      }
    });

    socket.on('updateMaxRounds', (data) => {
      const room = getRoom(data.roomCode);
      if (!room) return;
      if (!verifyPlayer(socket, data.roomCode, room.hostId ?? '')) return;
      if (room.phase !== 'lobby') return;

      const rounds = Math.min(MAX_ROUNDS, Math.max(MIN_ROUNDS, data.maxRounds));
      room.maxRounds = rounds;
      broadcastRoom(nsp, room);
    });

    socket.on('updateRoomSettings', (data) => {
      const room = getRoom(data.roomCode);
      if (!room) return;
      if (!verifyPlayer(socket, data.roomCode, room.hostId ?? '')) return;
      if (room.phase !== 'lobby') return;
      if (!isLanguage(data.language)) return;

      room.language = data.language;
      room.excludedLetters = normalizeExcludedLetters(data.excludedLetters);
      broadcastRoom(nsp, room);
    });

    socket.on('startGame', (data, cb) => {
      const instrumentation = startSocketHandlerInstrumentation(namespace, 'startGame');
      const respond = instrumentation.wrapCallback(cb);
      try {
        const room = getRoom(data.roomCode);
        if (!room) return respond({ ok: false, error: 'Room not found' });
        if (!verifyPlayer(socket, data.roomCode, room.hostId ?? '')) {
          socketLogger.warn(
            { roomCode: data.roomCode, playerId: data.playerId },
            'startGame rejected: actor is not blackout host'
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
        const readerId = room.hostId ?? getRandomReader(room);
        startNewRound(room, readerId);
        broadcastRoom(nsp, room);
        socketLogger.info(
          {
            roomCode: room.code,
            hostPlayerId: room.hostId,
            connectedPlayers: connectedPlayers.length,
          },
          'started blackout game'
        );
        respond({ ok: true });
      } catch (err) {
        instrumentation.finishError();
        throw err;
      }
    });

    socket.on('revealCategory', (data) => {
      const room = getRoom(data.roomCode);
      if (!room || !room.currentRound) return;
      if (!verifyPlayer(socket, data.roomCode, room.hostId ?? '')) return;
      if (room.currentRound.revealed) return;

      revealCategory(room);
      broadcastRoom(nsp, room);
    });

    socket.on('rerollPrompt', (data) => {
      const room = getRoom(data.roomCode);
      if (!room || !room.currentRound) return;
      if (!verifyPlayer(socket, data.roomCode, room.hostId ?? '')) return;

      rerollCurrentPrompt(room);
      broadcastRoom(nsp, room);
    });

    socket.on('selectWinner', (data) => {
      const room = getRoom(data.roomCode);
      if (!room || !room.currentRound) return;
      if (!verifyPlayer(socket, data.roomCode, room.hostId ?? '')) return;
      if (!room.currentRound.revealed) return;
      if (!room.players[data.winnerId]?.connected) return;
      if (data.winnerId === room.currentRound.readerId) return;

      selectRoundWinner(room, data.winnerId);
      addPoint(room, data.winnerId);
      assignHost(room, data.winnerId);
      advanceRound(data.roomCode);
    });

    socket.on('skipRound', (data) => {
      const room = getRoom(data.roomCode);
      if (!room || !room.currentRound) return;
      const socketIdx = getSocketIndex(socket.id);
      if (!socketIdx || socketIdx.roomCode !== data.roomCode) return;
      const canSkip = socketIdx.playerId === room.hostId || socketIdx.playerId === room.ownerId;
      if (!canSkip) return;
      advanceRound(data.roomCode);
    });

    socket.on('restartGame', (data) => {
      const room = getRoom(data.roomCode);
      if (!room) return;
      if (!verifyPlayer(socket, data.roomCode, room.hostId ?? '')) {
        socketLogger.warn(
          { roomCode: data.roomCode, playerId: data.playerId },
          'restartGame rejected: actor is not blackout host'
        );
        return;
      }

      resetScores(room);
      transitionToLobby(room);
      broadcastRoom(nsp, room);
      socketLogger.info(
        {
          roomCode: room.code,
          hostPlayerId: room.hostId,
        },
        'restarted blackout game'
      );
    });

    socket.on('requestState', (data) => {
      const room = getRoom(data.roomCode);
      if (!room) return;
      const socketIdx = getSocketIndex(socket.id);
      if (!socketIdx || socketIdx.roomCode !== data.roomCode) return;

      sendRoomToPlayer(nsp, room, socketIdx.playerId);
    });

    socket.on('disconnect', (reason) => {
      setNamespaceConnectionCount({ namespace, gameId }, nsp.sockets.size);
      const instrumentation = startSocketHandlerInstrumentation(namespace, 'disconnect');
      try {
        const index = getSocketIndex(socket.id);
        if (!index) {
          socketLogger.debug({ reason }, 'blackout client disconnected before room binding');
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

            // Reassign host if the disconnected player was the host
            if (wasHost) {
              const remaining = Object.values(room.players);
              const newHost =
                remaining.find((p) => p.id !== index.playerId && p.connected) ??
                remaining.find((p) => p.id !== index.playerId);

              if (newHost) {
                assignHost(room, newHost.id);
                // Update reader if in a round
                if (room.currentRound) {
                  room.currentRound.readerId = newHost.id;
                }
              } else {
                room.hostId = null;
              }
            }

            broadcastRoom(nsp, room);

            // Schedule cleanup if no players are connected
            const allDisconnected = Object.values(room.players).every((p) => !p.connected);
            if (allDisconnected) {
              scheduleRoomCleanup(room.code, 5 * 60 * 1000); // 5 minutes idle timeout
              gameLogger.info({ roomCode: room.code }, 'scheduled blackout room cleanup');
            }
          }
        }
        deleteSocketIndex(socket.id);
        socketLogger.info(
          {
            reason,
            roomCode: index.roomCode,
            playerId: index.playerId,
          },
          'blackout client disconnected'
        );
        instrumentation.finishSuccess();
      } catch (err) {
        instrumentation.finishError();
        throw err;
      }
    });
  });
}
