import type { Server, Socket } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '../../../core/src/events';
import type { Card, LogEntry, PlayerRole, Room } from '../../../core/src/types';
import {
  createComponentLogger,
  readLoggingConfig,
  toLoggableError,
} from '../../../../../apps/platform/server/logging/logger';
import {
  attachSocketEventDebugLogging,
  createSocketLogger,
} from '../../../../../apps/platform/server/logging/socketLogger';
import { startSocketHandlerInstrumentation } from '../../../../../apps/platform/server/observability/socketHandlerMetrics';
import {
  recordNamespaceConnection,
  recordNamespaceDisconnect,
} from '../../../../../apps/platform/server/observability/socketNamespaceMetrics';
import {
  authorizePartyJoin,
  normalizeJoinToken,
  normalizeStablePlayerId,
  readArrayIndex,
  readFiniteNumber,
  readString,
  syncRoomHostAfterJoin,
} from '../../../../../apps/platform/server/party/gameAuth';
import {
  ASSASSIN_PENALTY_MODES,
  BOARD_SIZE,
  DEFAULT_ASSASSIN_PENALTY_MODE,
  MAX_SIGNAL_NUMBER,
  MAX_TEAMS,
  MIN_SIGNAL_NUMBER,
  MIN_TEAMS,
  getActiveTeamColors,
  getMinimumPlayersForTeamCount,
} from '../../../core/src/constants';
import { broadcastRoom, sendRoomToPlayer } from '../managers/broadcastManager';
import {
  transitionToEnded,
  transitionToLobby,
  transitionToPlaying,
  validateTeamSetup,
} from '../managers/phaseManager';
import {
  advanceToNextTeam,
  giveSignal,
  outcomeToEndReason,
  processGuess,
} from '../managers/turnManager';
import { createPlayer, deleteSocketIndex, getSocketIndex, setSocketIndex } from '../models/player';
import {
  clearRoomCleanup,
  createRoom,
  deleteRoom,
  getRoom,
  getSessionRoom,
  scheduleRoomCleanup,
  setSessionToRoom,
} from '../models/room';

const GAME_ID = 'secret-signals';

type GameSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

function verifyPlayer(socket: GameSocket, roomCode: string, playerId: string): boolean {
  const index = getSocketIndex(socket.id);
  return index !== undefined && index.roomCode === roomCode && index.playerId === playerId;
}

export function registerGame(io: Server, namespace = `/g/${GAME_ID}`): void {
  const nsp = io.of(namespace);
  const gameLogger = createComponentLogger('game-server', { gameId: GAME_ID, namespace });
  const socketEventDebugEnabled = readLoggingConfig().socketEvents;

  nsp.use((socket, next) => {
    const auth = socket.handshake.auth || {};
    socket.data.sessionId = auth.sessionId;
    socket.data.playerId = auth.playerId;
    socket.data.joinToken = auth.joinToken || auth.token;
    next();
  });

  nsp.on('connection', (socket: GameSocket) => {
    const socketLogger = createSocketLogger(gameLogger, socket);

    attachSocketEventDebugLogging(socket, socketLogger, socketEventDebugEnabled);
    socketLogger.debug('game client connected');
    recordNamespaceConnection({ namespace, gameId: GAME_ID }, nsp);

    socket.on('autoJoinRoom', (data, cb) => {
      const instrumentation = startSocketHandlerInstrumentation(namespace, 'autoJoinRoom', GAME_ID);
      const respond = instrumentation.wrapCallback(cb);
      try {
        const sessionId = readString(data?.sessionId)?.trim();
        if (!sessionId) {
          return respond({ ok: false, error: 'Missing session info' });
        }

        const stablePlayerId =
          normalizeStablePlayerId(data.playerId) ?? normalizeStablePlayerId(socket.data.playerId);
        const joinToken = normalizeJoinToken(data.joinToken, socket.data.joinToken);

        // Validate the platform joinToken against the active party match and
        // derive authoritative player identity + host from party state.
        const authorization = authorizePartyJoin(GAME_ID, sessionId, stablePlayerId, joinToken);
        if (!authorization.ok) {
          socketLogger.warn(
            { sessionId, playerId: stablePlayerId, reason: authorization.reason },
            'autoJoinRoom rejected: unauthorized secret-signals party member'
          );
          return respond({ ok: false, error: authorization.error });
        }

        const authorizedPlayerId = authorization.member.playerId;
        const name = authorization.member.name;
        const providedResumeToken =
          typeof data.resumeToken === 'string' ? data.resumeToken : undefined;

        const mappedRoomCode = getSessionRoom(sessionId);
        const mappedRoom = mappedRoomCode ? getRoom(mappedRoomCode) : undefined;

        if (!mappedRoom) {
          const { room, hostId, resumeToken } = createRoom(name, socket.id, authorizedPlayerId);
          setSessionToRoom(sessionId, room.code);
          socket.join(room.code);
          syncRoomHostAfterJoin(room, authorization.hostPlayerId, !authorization.hostConnected);
          broadcastRoom(nsp, room);
          socketLogger.info(
            {
              roomCode: room.code,
              playerId: hostId,
              sessionId,
            },
            'created secret-signals room'
          );
          return respond({ ok: true, roomCode: room.code, playerId: hostId, resumeToken });
        }

        if (mappedRoom.players[authorizedPlayerId]) {
          const existingPlayer = mappedRoom.players[authorizedPlayerId];
          // Require the server-issued resumeToken to prevent slot hijacking via public playerId.
          if (providedResumeToken && existingPlayer.resumeToken !== providedResumeToken) {
            socketLogger.warn(
              { roomCode: mappedRoom.code, playerId: existingPlayer.id, sessionId },
              'autoJoinRoom rejected: invalid secret-signals resume token'
            );
            return respond({ ok: false, error: 'Invalid resume token' });
          }
          if (!providedResumeToken && existingPlayer.resumeToken) {
            socketLogger.warn(
              { roomCode: mappedRoom.code, playerId: existingPlayer.id, sessionId },
              'autoJoinRoom rejected: secret-signals resume token required'
            );
            return respond({ ok: false, error: 'Resume token required' });
          }

          if (existingPlayer.socketId && existingPlayer.socketId !== socket.id) {
            deleteSocketIndex(existingPlayer.socketId);
          }
          existingPlayer.socketId = socket.id;
          existingPlayer.connected = true;
          setSocketIndex(socket.id, mappedRoom.code, existingPlayer.id);
          clearRoomCleanup(mappedRoom.code);
          syncRoomHostAfterJoin(
            mappedRoom,
            authorization.hostPlayerId,
            !authorization.hostConnected
          );
          socket.join(mappedRoom.code);
          broadcastRoom(nsp, mappedRoom);
          socketLogger.info(
            {
              roomCode: mappedRoom.code,
              playerId: existingPlayer.id,
              sessionId,
              resumed: true,
            },
            'player rejoined secret-signals room'
          );
          return respond({
            ok: true,
            roomCode: mappedRoom.code,
            playerId: existingPlayer.id,
            resumeToken: existingPlayer.resumeToken,
          });
        }

        if (mappedRoom.phase !== 'lobby') {
          return respond({ ok: false, error: 'Game already started' });
        }

        const nameExists = Object.values(mappedRoom.players).some(
          (player) => player.name.toLowerCase() === name.toLowerCase()
        );
        if (nameExists) {
          return respond({ ok: false, error: 'Name already taken' });
        }

        const player = createPlayer(name, false, authorizedPlayerId);
        player.socketId = socket.id;
        mappedRoom.players[player.id] = player;
        setSocketIndex(socket.id, mappedRoom.code, player.id);
        clearRoomCleanup(mappedRoom.code);
        syncRoomHostAfterJoin(mappedRoom, authorization.hostPlayerId, !authorization.hostConnected);
        socket.join(mappedRoom.code);
        broadcastRoom(nsp, mappedRoom);
        socketLogger.info(
          {
            roomCode: mappedRoom.code,
            playerId: player.id,
            sessionId,
            resumed: false,
          },
          'player joined existing secret-signals room'
        );
        respond({
          ok: true,
          roomCode: mappedRoom.code,
          playerId: player.id,
          resumeToken: player.resumeToken,
        });
      } catch (err) {
        instrumentation.finishError();
        socketLogger.error({ err: toLoggableError(err) }, 'autoJoinRoom failed unexpectedly');
        respond({ ok: false, error: 'Internal error' });
      }
    });

    socket.on('resumePlayer', (data, cb) => {
      const instrumentation = startSocketHandlerInstrumentation(namespace, 'resumePlayer', GAME_ID);
      const respond = instrumentation.wrapCallback(cb);
      try {
        const room = getRoom(data.roomCode);
        if (!room) return respond({ ok: false, error: 'Room not found' });

        const player = room.players[data.playerId];
        if (!player) return respond({ ok: false, error: 'Player not found' });
        if (player.resumeToken !== data.resumeToken) {
          socketLogger.warn(
            { roomCode: room.code, playerId: data.playerId },
            'resumePlayer rejected: invalid secret-signals resume token'
          );
          return respond({ ok: false, error: 'Invalid resume token' });
        }

        if (player.socketId) deleteSocketIndex(player.socketId);

        player.socketId = socket.id;
        player.connected = true;
        setSocketIndex(socket.id, room.code, player.id);
        clearRoomCleanup(room.code);

        socket.join(room.code);
        broadcastRoom(nsp, room);
        socketLogger.info(
          {
            roomCode: room.code,
            playerId: player.id,
          },
          'resumed secret-signals player'
        );
        respond({ ok: true });
      } catch (err) {
        instrumentation.finishError();
        socketLogger.error({ err: toLoggableError(err) }, 'resumePlayer failed unexpectedly');
        respond({ ok: false, error: 'Internal error' });
      }
    });

    socket.on('requestState', (data) => {
      const instrumentation = startSocketHandlerInstrumentation(namespace, 'requestState', GAME_ID);
      try {
        const room = getRoom(data.roomCode);
        if (!room) {
          instrumentation.finishRejected();
          return;
        }
        const socketIdx = getSocketIndex(socket.id);
        if (!socketIdx || socketIdx.roomCode !== data.roomCode) {
          instrumentation.finishRejected();
          return;
        }
        sendRoomToPlayer(nsp, room, socketIdx.playerId);
        instrumentation.finishSuccess();
      } catch (err) {
        instrumentation.finishError();
        socketLogger.error({ err: toLoggableError(err) }, 'requestState failed unexpectedly');
      }
    });

    socket.on('leaveRoom', (data, cb) => {
      const instrumentation = startSocketHandlerInstrumentation(namespace, 'leaveRoom', GAME_ID);
      const respond = instrumentation.wrapCallback(cb);
      try {
        const room = getRoom(data.roomCode);
        if (!room) return respond({ ok: false, error: 'Room not found' });

        const player = room.players[data.playerId];
        if (!player) return respond({ ok: false, error: 'Player not found' });
        if (player.socketId !== socket.id) return respond({ ok: false, error: 'Unauthorized' });

        socket.leave(data.roomCode);
        deleteSocketIndex(socket.id);

        if (room.phase === 'playing') {
          player.connected = false;
          player.socketId = null;
          if (player.isHost) {
            reassignHost(room, player.id);
          }
          room.focusedCards = room.focusedCards.filter((marker) => marker.playerId !== player.id);

          const anyConnected = Object.values(room.players).some((candidate) => candidate.connected);
          if (!anyConnected) {
            scheduleRoomCleanup(room.code);
          }

          broadcastRoom(nsp, room);
          return respond({ ok: true });
        }

        removePlayerFromRoom(room, player.id);

        if (Object.keys(room.players).length === 0) {
          clearRoomCleanup(room.code);
          deleteRoom(room.code);
          socketLogger.info(
            { roomCode: room.code },
            'deleted empty secret-signals room after leave'
          );
          return respond({ ok: true });
        }

        reassignHost(room, player.id);
        broadcastRoom(nsp, room);
        socketLogger.info(
          {
            roomCode: room.code,
            playerId: player.id,
            remainingPlayers: Object.keys(room.players).length,
          },
          'player left secret-signals room'
        );
        respond({ ok: true });
      } catch (err) {
        instrumentation.finishError();
        socketLogger.error({ err: toLoggableError(err) }, 'leaveRoom failed unexpectedly');
        respond({ ok: false, error: 'Internal error' });
      }
    });

    socket.on('setTeamCount', (data, cb) => {
      const instrumentation = startSocketHandlerInstrumentation(namespace, 'setTeamCount', GAME_ID);
      const respond = instrumentation.wrapCallback(cb);
      try {
        const room = getRoom(data.roomCode);
        if (!room) return respond({ ok: false, error: 'Room not found' });
        if (!verifyPlayer(socket, data.roomCode, room.hostId ?? ''))
          return respond({ ok: false, error: 'Only host can change' });
        if (room.phase !== 'lobby') return respond({ ok: false, error: 'Game already started' });

        const teamCount = readFiniteNumber(data.teamCount);
        if (teamCount === undefined || teamCount < MIN_TEAMS || teamCount > MAX_TEAMS) {
          return respond({ ok: false, error: `Team count must be ${MIN_TEAMS}-${MAX_TEAMS}` });
        }

        const previousTeamCount = room.teamCount;
        room.teamCount = teamCount;
        room.turnOrder = getActiveTeamColors(teamCount);
        room.nextStartingTeamIndex %= teamCount;

        if (
          previousTeamCount <= 2 &&
          teamCount > 2 &&
          room.assassinPenaltyMode === DEFAULT_ASSASSIN_PENALTY_MODE
        ) {
          room.assassinPenaltyMode = 'elimination';
        }

        const activeColors = new Set(room.turnOrder);
        for (const player of Object.values(room.players)) {
          if (player.team && !activeColors.has(player.team)) {
            player.team = null;
            player.role = null;
          }
        }

        broadcastRoom(nsp, room);
        respond({ ok: true });
      } catch (err) {
        instrumentation.finishError();
        socketLogger.error({ err: toLoggableError(err) }, 'setTeamCount failed unexpectedly');
        respond({ ok: false, error: 'Internal error' });
      }
    });

    socket.on('setAssassinPenaltyMode', (data, cb) => {
      const instrumentation = startSocketHandlerInstrumentation(
        namespace,
        'setAssassinPenaltyMode',
        GAME_ID
      );
      const respond = instrumentation.wrapCallback(cb);
      try {
        const room = getRoom(data.roomCode);
        if (!room) return respond({ ok: false, error: 'Room not found' });
        if (!verifyPlayer(socket, data.roomCode, room.hostId ?? ''))
          return respond({ ok: false, error: 'Only host can change' });
        if (room.phase !== 'lobby') return respond({ ok: false, error: 'Game already started' });
        if (!ASSASSIN_PENALTY_MODES.includes(data.mode)) {
          return respond({ ok: false, error: 'Invalid assassin mode' });
        }

        room.assassinPenaltyMode = data.mode;
        broadcastRoom(nsp, room);
        respond({ ok: true });
      } catch (err) {
        instrumentation.finishError();
        socketLogger.error(
          { err: toLoggableError(err) },
          'setAssassinPenaltyMode failed unexpectedly'
        );
        respond({ ok: false, error: 'Internal error' });
      }
    });

    socket.on('focusCard', (data, cb) => {
      const instrumentation = startSocketHandlerInstrumentation(namespace, 'focusCard', GAME_ID);
      const respond = instrumentation.wrapCallback(cb);
      try {
        const room = getRoom(data.roomCode);
        if (!room) return respond({ ok: false, error: 'Room not found' });
        if (room.phase !== 'playing') return respond({ ok: false, error: 'Game not in progress' });
        if (room.turnPhase !== 'guessing')
          return respond({ ok: false, error: 'Not guessing phase' });

        const socketIdx = getSocketIndex(socket.id);
        const player = socketIdx ? room.players[socketIdx.playerId] : undefined;
        if (!player) return respond({ ok: false, error: 'Player not found' });
        if (player.team !== room.currentTurnTeam)
          return respond({ ok: false, error: 'Not your turn' });
        if (player.role !== 'agent')
          return respond({ ok: false, error: 'Only agents can mark cards' });

        if (data.cardIndex === null) {
          room.focusedCards = room.focusedCards.filter((marker) => marker.playerId !== player.id);
          broadcastRoom(nsp, room);
          return respond({ ok: true });
        }

        const cardIndex = readArrayIndex(data.cardIndex);
        if (cardIndex === undefined || cardIndex >= BOARD_SIZE) {
          return respond({ ok: false, error: 'Invalid card index' });
        }

        const card = room.board[cardIndex];
        if (card.revealed) return respond({ ok: false, error: 'Card already revealed' });

        const alreadyMarked = room.focusedCards.some(
          (marker) => marker.playerId === player.id && marker.cardIndex === cardIndex
        );

        if (!alreadyMarked) {
          room.focusedCards.push({ cardIndex, playerId: player.id });
        }

        broadcastRoom(nsp, room);
        respond({ ok: true });
      } catch (err) {
        instrumentation.finishError();
        socketLogger.error({ err: toLoggableError(err) }, 'focusCard failed unexpectedly');
        respond({ ok: false, error: 'Internal error' });
      }
    });

    socket.on('assignTeam', (data, cb) => {
      const instrumentation = startSocketHandlerInstrumentation(namespace, 'assignTeam', GAME_ID);
      const respond = instrumentation.wrapCallback(cb);
      try {
        const room = getRoom(data.roomCode);
        if (!room) return respond({ ok: false, error: 'Room not found' });
        if (room.phase !== 'lobby') return respond({ ok: false, error: 'Game already started' });

        const socketIdx = getSocketIndex(socket.id);
        const player = socketIdx ? room.players[socketIdx.playerId] : undefined;
        if (!player) return respond({ ok: false, error: 'Player not found' });

        const activeColors = getActiveTeamColors(room.teamCount);
        if (!activeColors.includes(data.team)) {
          return respond({ ok: false, error: 'Invalid team' });
        }

        if (player.team !== data.team) {
          player.role = null;
        }
        player.team = data.team;

        broadcastRoom(nsp, room);
        respond({ ok: true });
      } catch (err) {
        instrumentation.finishError();
        socketLogger.error({ err: toLoggableError(err) }, 'assignTeam failed unexpectedly');
        respond({ ok: false, error: 'Internal error' });
      }
    });

    socket.on('assignRole', (data, cb) => {
      const instrumentation = startSocketHandlerInstrumentation(namespace, 'assignRole', GAME_ID);
      const respond = instrumentation.wrapCallback(cb);
      try {
        const room = getRoom(data.roomCode);
        if (!room) return respond({ ok: false, error: 'Room not found' });
        if (room.phase !== 'lobby') return respond({ ok: false, error: 'Game already started' });

        const socketIdx = getSocketIndex(socket.id);
        const player = socketIdx ? room.players[socketIdx.playerId] : undefined;
        if (!player) return respond({ ok: false, error: 'Player not found' });
        if (!player.team) return respond({ ok: false, error: 'Choose a team first' });

        const validRoles: PlayerRole[] = ['director', 'agent'];
        if (!validRoles.includes(data.role)) {
          return respond({ ok: false, error: 'Invalid role' });
        }

        if (data.role === 'director') {
          const existingDirector = Object.values(room.players).find(
            (otherPlayer) =>
              otherPlayer.team === player.team &&
              otherPlayer.role === 'director' &&
              otherPlayer.id !== player.id
          );

          if (existingDirector) {
            return respond({
              ok: false,
              error: `${existingDirector.name} is already the Director for ${player.team}`,
            });
          }
        }

        if (data.role === 'agent' && player.role === 'director') {
          for (const otherPlayer of Object.values(room.players)) {
            if (
              otherPlayer.team === player.team &&
              otherPlayer.role === 'director' &&
              otherPlayer.id !== player.id
            ) {
              return respond({
                ok: false,
                error: 'Cannot demote another director from your seat',
              });
            }
          }
        }

        player.role = data.role;

        broadcastRoom(nsp, room);
        respond({ ok: true });
      } catch (err) {
        instrumentation.finishError();
        socketLogger.error({ err: toLoggableError(err) }, 'assignRole failed unexpectedly');
        respond({ ok: false, error: 'Internal error' });
      }
    });

    socket.on('startGame', (data, cb) => {
      const instrumentation = startSocketHandlerInstrumentation(namespace, 'startGame', GAME_ID);
      const respond = instrumentation.wrapCallback(cb);
      try {
        const room = getRoom(data.roomCode);
        if (!room) return respond({ ok: false, error: 'Room not found' });
        if (!verifyPlayer(socket, data.roomCode, room.hostId ?? '')) {
          socketLogger.warn(
            { roomCode: data.roomCode, playerId: data.playerId },
            'startGame rejected: actor is not secret-signals host'
          );
          return respond({ ok: false, error: 'Only host can start' });
        }
        if (room.phase !== 'lobby') return respond({ ok: false, error: 'Game already started' });

        const minimumPlayers = getMinimumPlayersForTeamCount(room.teamCount);
        const connected = Object.values(room.players).filter((player) => player.connected);
        if (connected.length < minimumPlayers) {
          return respond({ ok: false, error: `Need at least ${minimumPlayers} players` });
        }

        const validation = validateTeamSetup(room);
        if (!validation.valid) {
          return respond({ ok: false, error: validation.error! });
        }

        transitionToPlaying(room);
        broadcastRoom(nsp, room);
        socketLogger.info(
          {
            roomCode: room.code,
            hostPlayerId: room.hostId,
            connectedPlayers: connected.length,
            teamCount: room.teamCount,
          },
          'started secret-signals game'
        );
        respond({ ok: true });
      } catch (err) {
        instrumentation.finishError();
        socketLogger.error({ err: toLoggableError(err) }, 'startGame failed unexpectedly');
        respond({ ok: false, error: 'Internal error' });
      }
    });

    socket.on('giveSignal', (data, cb) => {
      const instrumentation = startSocketHandlerInstrumentation(namespace, 'giveSignal', GAME_ID);
      const respond = instrumentation.wrapCallback(cb);
      try {
        const room = getRoom(data.roomCode);
        if (!room) return respond({ ok: false, error: 'Room not found' });
        if (room.phase !== 'playing') return respond({ ok: false, error: 'Game not in progress' });
        if (room.turnPhase !== 'giving-signal')
          return respond({ ok: false, error: 'Not signal phase' });

        const socketIdx = getSocketIndex(socket.id);
        const player = socketIdx ? room.players[socketIdx.playerId] : undefined;
        if (!player) return respond({ ok: false, error: 'Player not found' });
        if (player.team !== room.currentTurnTeam)
          return respond({ ok: false, error: 'Not your turn' });
        if (player.role !== 'director')
          return respond({ ok: false, error: 'Only director can signal' });

        const word = readString(data.word)?.trim().toUpperCase();
        if (!word || word.includes(' ')) {
          return respond({ ok: false, error: 'Signal must be a single word' });
        }

        const matchesBoard = room.board.some((card) => !card.revealed && card.word === word);
        if (matchesBoard) {
          return respond({ ok: false, error: 'Signal cannot match a word on the board' });
        }

        const number = readFiniteNumber(data.number);
        if (number === undefined || number < MIN_SIGNAL_NUMBER || number > MAX_SIGNAL_NUMBER) {
          return respond({
            ok: false,
            error: `Number must be ${MIN_SIGNAL_NUMBER}-${MAX_SIGNAL_NUMBER}`,
          });
        }

        giveSignal(room, word, number);
        broadcastRoom(nsp, room);
        respond({ ok: true });
      } catch (err) {
        instrumentation.finishError();
        socketLogger.error({ err: toLoggableError(err) }, 'giveSignal failed unexpectedly');
        respond({ ok: false, error: 'Internal error' });
      }
    });

    socket.on('revealCard', (data, cb) => {
      const instrumentation = startSocketHandlerInstrumentation(namespace, 'revealCard', GAME_ID);
      const respond = instrumentation.wrapCallback(cb);
      try {
        const room = getRoom(data.roomCode);
        if (!room) return respond({ ok: false, error: 'Room not found' });
        if (room.phase !== 'playing') return respond({ ok: false, error: 'Game not in progress' });
        if (room.turnPhase !== 'guessing')
          return respond({ ok: false, error: 'Not guessing phase' });

        const socketIdx = getSocketIndex(socket.id);
        const player = socketIdx ? room.players[socketIdx.playerId] : undefined;
        if (!player) return respond({ ok: false, error: 'Player not found' });
        if (player.team !== room.currentTurnTeam)
          return respond({ ok: false, error: 'Not your turn' });
        if (player.role !== 'agent') return respond({ ok: false, error: 'Only agents can guess' });

        const cardIndex = readArrayIndex(data.cardIndex);
        if (cardIndex === undefined || cardIndex >= BOARD_SIZE) {
          return respond({ ok: false, error: 'Invalid card index' });
        }

        const card = room.board[cardIndex];
        if (card.revealed) return respond({ ok: false, error: 'Card already revealed' });

        const result = processGuess(room, cardIndex, player.team!);

        if (result.gameOver) {
          addLogEntry(room, result.outcome === 'assassin' ? 'assassin' : 'correct-complete');
          transitionToEnded(room, result.winners!);
        } else if (result.turnEnds) {
          const endReason = outcomeToEndReason(
            result.outcome,
            result.outcome === 'correct' &&
              room.currentSignal!.number > 0 &&
              room.currentSignal!.guessesUsed > room.currentSignal!.number
          );
          addLogEntry(room, endReason);
          advanceToNextTeam(room);
        }

        broadcastRoom(nsp, room);
        respond({ ok: true });
      } catch (err) {
        instrumentation.finishError();
        socketLogger.error({ err: toLoggableError(err) }, 'revealCard failed unexpectedly');
        respond({ ok: false, error: 'Internal error' });
      }
    });

    socket.on('endTurn', (data, cb) => {
      const instrumentation = startSocketHandlerInstrumentation(namespace, 'endTurn', GAME_ID);
      const respond = instrumentation.wrapCallback(cb);
      try {
        const room = getRoom(data.roomCode);
        if (!room) return respond({ ok: false, error: 'Room not found' });
        if (room.phase !== 'playing') return respond({ ok: false, error: 'Game not in progress' });
        if (room.turnPhase !== 'guessing')
          return respond({ ok: false, error: 'Not guessing phase' });

        const socketIdx = getSocketIndex(socket.id);
        const player = socketIdx ? room.players[socketIdx.playerId] : undefined;
        if (!player) return respond({ ok: false, error: 'Player not found' });
        if (player.team !== room.currentTurnTeam)
          return respond({ ok: false, error: 'Not your turn' });
        if (player.role !== 'agent')
          return respond({ ok: false, error: 'Only agents can end turn' });

        addLogEntry(room, 'voluntary');
        advanceToNextTeam(room);
        broadcastRoom(nsp, room);
        respond({ ok: true });
      } catch (err) {
        instrumentation.finishError();
        socketLogger.error({ err: toLoggableError(err) }, 'endTurn failed unexpectedly');
        respond({ ok: false, error: 'Internal error' });
      }
    });

    socket.on('skipGuessRound', (data, cb) => {
      const instrumentation = startSocketHandlerInstrumentation(
        namespace,
        'skipGuessRound',
        GAME_ID
      );
      const respond = instrumentation.wrapCallback(cb);
      try {
        const room = getRoom(data.roomCode);
        if (!room) return respond({ ok: false, error: 'Room not found' });
        if (room.phase !== 'playing') return respond({ ok: false, error: 'Game not in progress' });
        if (!room.turnPhase) return respond({ ok: false, error: 'No active turn to skip' });
        if (!verifyPlayer(socket, data.roomCode, room.hostId ?? ''))
          return respond({ ok: false, error: 'Only host can skip' });

        if (room.turnPhase === 'guessing') {
          addLogEntry(room, 'voluntary');
        }
        advanceToNextTeam(room);
        broadcastRoom(nsp, room);
        respond({ ok: true });
      } catch (err) {
        instrumentation.finishError();
        socketLogger.error({ err: toLoggableError(err) }, 'skipGuessRound failed unexpectedly');
        respond({ ok: false, error: 'Internal error' });
      }
    });

    socket.on('restartGame', (data, cb) => {
      const instrumentation = startSocketHandlerInstrumentation(namespace, 'restartGame', GAME_ID);
      const respond = instrumentation.wrapCallback(cb);
      try {
        const room = getRoom(data.roomCode);
        if (!room) return respond({ ok: false, error: 'Room not found' });
        if (!verifyPlayer(socket, data.roomCode, room.hostId ?? '')) {
          socketLogger.warn(
            { roomCode: data.roomCode, playerId: data.playerId },
            'restartGame rejected: actor is not secret-signals host'
          );
          return respond({ ok: false, error: 'Only host can restart' });
        }

        transitionToLobby(room);
        broadcastRoom(nsp, room);
        socketLogger.info(
          {
            roomCode: room.code,
            hostPlayerId: room.hostId,
          },
          'restarted secret-signals game'
        );
        respond({ ok: true });
      } catch (err) {
        instrumentation.finishError();
        socketLogger.error({ err: toLoggableError(err) }, 'restartGame failed unexpectedly');
        respond({ ok: false, error: 'Internal error' });
      }
    });

    socket.on('disconnect', (reason) => {
      const instrumentation = startSocketHandlerInstrumentation(namespace, 'disconnect');
      try {
        const index = getSocketIndex(socket.id);
        if (!index) {
          socketLogger.debug({ reason }, 'secret-signals client disconnected before room binding');
          recordNamespaceDisconnect({ namespace, gameId: GAME_ID }, nsp);
          instrumentation.finishSuccess();
          return;
        }

        const room = getRoom(index.roomCode);
        if (room) {
          const player = room.players[index.playerId];
          if (player) {
            player.connected = false;
            player.socketId = null;
            room.focusedCards = room.focusedCards.filter((marker) => marker.playerId !== player.id);

            // Reassign host if the disconnected player was the host
            if (player.isHost) {
              reassignHost(room, player.id);
            }

            broadcastRoom(nsp, room);

            // Schedule cleanup if no players are connected
            const anyConnected = Object.values(room.players).some((p) => p.connected);
            if (!anyConnected) {
              scheduleRoomCleanup(room.code);
              gameLogger.info({ roomCode: room.code }, 'scheduled secret-signals room cleanup');
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
          'secret-signals client disconnected'
        );
        recordNamespaceDisconnect({ namespace, gameId: GAME_ID }, nsp);
        instrumentation.finishSuccess();
      } catch (err) {
        instrumentation.finishError();
        socketLogger.error(
          { err: toLoggableError(err) },
          'secret-signals disconnect handling failed'
        );
      }
    });
  });
}

function removePlayerFromRoom(room: Room, playerId: string): void {
  delete room.players[playerId];
  room.focusedCards = room.focusedCards.filter((marker) => marker.playerId !== playerId);
}

function reassignHost(room: Room, departedPlayerId: string): void {
  if (room.hostId !== departedPlayerId) return;

  const remainingPlayers = Object.values(room.players).filter(
    (player) => player.id !== departedPlayerId
  );
  for (const player of Object.values(room.players)) {
    player.isHost = false;
  }

  const nextHost =
    remainingPlayers.find((player) => player.connected) ?? remainingPlayers[0] ?? null;

  room.hostId = nextHost?.id ?? null;
  if (nextHost) {
    nextHost.isHost = true;
  }
}

function addLogEntry(room: Room, endReason: LogEntry['endReason']): void {
  if (!room.currentSignal) return;

  const revealedCards = room.board
    .filter((card: Card) => card.revealed && card.revealedBy === room.currentTurnTeam)
    .map((card: Card) => ({ word: card.word, type: card.type }));

  const recentCards = revealedCards.slice(-room.currentSignal.guessesUsed);

  room.log.push({
    teamColor: room.currentSignal.teamColor,
    signal: { word: room.currentSignal.word, number: room.currentSignal.number },
    revealedCards: recentCards,
    endReason,
  });
}
