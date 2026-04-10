import type { Server, Socket } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '../../../core/src/events';
import type { Card, LogEntry, PlayerRole, Room } from '../../../core/src/types';
import {
  createComponentLogger,
  readLoggingConfig,
} from '../../../../../apps/platform/server/logging/logger';
import {
  attachSocketEventDebugLogging,
  createSocketLogger,
} from '../../../../../apps/platform/server/logging/socketLogger';
import { startSocketHandlerInstrumentation } from '../../../../../apps/platform/server/observability/socketHandlerMetrics';
import {
  recordSocketEventEnd,
  recordSocketEventStart,
  setNamespaceConnectionCount,
} from '../../../../../apps/platform/server/metrics/metrics';
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
const MAX_PLAYER_NAME_LENGTH = 20;

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
    next();
  });

  nsp.on('connection', (socket: GameSocket) => {
    const socketLogger = createSocketLogger(gameLogger, socket);

    attachSocketEventDebugLogging(socket, socketLogger, socketEventDebugEnabled);
    socketLogger.debug('game client connected');
    setNamespaceConnectionCount({ namespace, gameId: GAME_ID }, nsp.sockets.size);
    recordSocketEventEnd(
      recordSocketEventStart({ namespace, event: 'connection', gameId: GAME_ID }),
      {
        result: 'ok',
      }
    );

    socket.on('autoJoinRoom', (data, cb) => {
      const instrumentation = startSocketHandlerInstrumentation(namespace, 'autoJoinRoom');
      const respond = instrumentation.wrapCallback(cb);
      try {
        const sessionId = data.sessionId?.trim();
        const normalizedName = (data.name ?? '').trim();
        const name = normalizedName.slice(0, MAX_PLAYER_NAME_LENGTH);
        const hubPlayerId = data.playerId?.trim();

        if (!sessionId || !normalizedName) {
          return respond({ ok: false, error: 'Missing session info' });
        }

        if (normalizedName.length > MAX_PLAYER_NAME_LENGTH) {
          return respond({
            ok: false,
            error: `Name must be ${MAX_PLAYER_NAME_LENGTH} characters or fewer`,
          });
        }

        const mappedRoomCode = getSessionRoom(sessionId);
        const mappedRoom = mappedRoomCode ? getRoom(mappedRoomCode) : undefined;

        if (!mappedRoom) {
          const { room, hostId, resumeToken } = createRoom(
            name,
            socket.id,
            hubPlayerId || undefined
          );
          setSessionToRoom(sessionId, room.code);
          socket.join(room.code);
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

        if (hubPlayerId) {
          const existingPlayer = mappedRoom.players[hubPlayerId];
          if (existingPlayer) {
            // Require the server-issued resumeToken to prevent slot hijacking via public playerId.
            if (data.resumeToken && existingPlayer.resumeToken !== data.resumeToken) {
              socketLogger.warn(
                { roomCode: mappedRoom.code, playerId: existingPlayer.id, sessionId },
                'autoJoinRoom rejected: invalid secret-signals resume token'
              );
              return respond({ ok: false, error: 'Invalid resume token' });
            }
            if (!data.resumeToken && existingPlayer.resumeToken) {
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
            if (existingPlayer.isHost || data.isHost) {
              for (const p of Object.values(mappedRoom.players)) {
                p.isHost = false;
              }
              existingPlayer.isHost = true;
              mappedRoom.hostId = existingPlayer.id;
            }
            setSocketIndex(socket.id, mappedRoom.code, existingPlayer.id);
            clearRoomCleanup(mappedRoom.code);
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

        const player = createPlayer(name, false, hubPlayerId || undefined);
        player.socketId = socket.id;
        mappedRoom.players[player.id] = player;
        if (data.isHost) {
          for (const p of Object.values(mappedRoom.players)) {
            p.isHost = false;
          }
          player.isHost = true;
          mappedRoom.hostId = player.id;
        }
        setSocketIndex(socket.id, mappedRoom.code, player.id);
        clearRoomCleanup(mappedRoom.code);
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
        throw err;
      }
    });

    socket.on('resumePlayer', (data, cb) => {
      const instrumentation = startSocketHandlerInstrumentation(namespace, 'resumePlayer');
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
        throw err;
      }
    });

    socket.on('requestState', (data) => {
      const room = getRoom(data.roomCode);
      if (!room) return;
      const socketIdx = getSocketIndex(socket.id);
      if (!socketIdx || socketIdx.roomCode !== data.roomCode) return;
      sendRoomToPlayer(nsp, room, socketIdx.playerId);
    });

    socket.on('leaveRoom', (data, cb) => {
      const instrumentation = startSocketHandlerInstrumentation(namespace, 'leaveRoom');
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
        throw err;
      }
    });

    socket.on('setTeamCount', (data, cb) => {
      const room = getRoom(data.roomCode);
      if (!room) return cb({ ok: false, error: 'Room not found' });
      if (!verifyPlayer(socket, data.roomCode, room.hostId ?? ''))
        return cb({ ok: false, error: 'Only host can change' });
      if (room.phase !== 'lobby') return cb({ ok: false, error: 'Game already started' });
      if (data.teamCount < MIN_TEAMS || data.teamCount > MAX_TEAMS) {
        return cb({ ok: false, error: `Team count must be ${MIN_TEAMS}-${MAX_TEAMS}` });
      }

      const previousTeamCount = room.teamCount;
      room.teamCount = data.teamCount;
      room.turnOrder = getActiveTeamColors(data.teamCount);
      room.nextStartingTeamIndex %= data.teamCount;

      if (
        previousTeamCount <= 2 &&
        data.teamCount > 2 &&
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
      cb({ ok: true });
    });

    socket.on('setAssassinPenaltyMode', (data, cb) => {
      const room = getRoom(data.roomCode);
      if (!room) return cb({ ok: false, error: 'Room not found' });
      if (!verifyPlayer(socket, data.roomCode, room.hostId ?? ''))
        return cb({ ok: false, error: 'Only host can change' });
      if (room.phase !== 'lobby') return cb({ ok: false, error: 'Game already started' });
      if (!ASSASSIN_PENALTY_MODES.includes(data.mode)) {
        return cb({ ok: false, error: 'Invalid assassin mode' });
      }

      room.assassinPenaltyMode = data.mode;
      broadcastRoom(nsp, room);
      cb({ ok: true });
    });

    socket.on('focusCard', (data, cb) => {
      const room = getRoom(data.roomCode);
      if (!room) return cb({ ok: false, error: 'Room not found' });
      if (room.phase !== 'playing') return cb({ ok: false, error: 'Game not in progress' });
      if (room.turnPhase !== 'guessing') return cb({ ok: false, error: 'Not guessing phase' });

      const socketIdx = getSocketIndex(socket.id);
      const player = socketIdx ? room.players[socketIdx.playerId] : undefined;
      if (!player) return cb({ ok: false, error: 'Player not found' });
      if (player.team !== room.currentTurnTeam) return cb({ ok: false, error: 'Not your turn' });
      if (player.role !== 'agent') return cb({ ok: false, error: 'Only agents can mark cards' });

      if (data.cardIndex === null) {
        room.focusedCards = room.focusedCards.filter((marker) => marker.playerId !== player.id);
        broadcastRoom(nsp, room);
        return cb({ ok: true });
      }

      if (data.cardIndex < 0 || data.cardIndex >= BOARD_SIZE) {
        return cb({ ok: false, error: 'Invalid card index' });
      }

      const card = room.board[data.cardIndex];
      if (card.revealed) return cb({ ok: false, error: 'Card already revealed' });

      const alreadyMarked = room.focusedCards.some(
        (marker) => marker.playerId === player.id && marker.cardIndex === data.cardIndex
      );

      if (!alreadyMarked) {
        room.focusedCards.push({ cardIndex: data.cardIndex, playerId: player.id });
      }

      broadcastRoom(nsp, room);
      cb({ ok: true });
    });

    socket.on('assignTeam', (data, cb) => {
      const room = getRoom(data.roomCode);
      if (!room) return cb({ ok: false, error: 'Room not found' });
      if (room.phase !== 'lobby') return cb({ ok: false, error: 'Game already started' });

      const socketIdx = getSocketIndex(socket.id);
      const player = socketIdx ? room.players[socketIdx.playerId] : undefined;
      if (!player) return cb({ ok: false, error: 'Player not found' });

      const activeColors = getActiveTeamColors(room.teamCount);
      if (!activeColors.includes(data.team)) {
        return cb({ ok: false, error: 'Invalid team' });
      }

      if (player.team !== data.team) {
        player.role = null;
      }
      player.team = data.team;

      broadcastRoom(nsp, room);
      cb({ ok: true });
    });

    socket.on('assignRole', (data, cb) => {
      const room = getRoom(data.roomCode);
      if (!room) return cb({ ok: false, error: 'Room not found' });
      if (room.phase !== 'lobby') return cb({ ok: false, error: 'Game already started' });

      const socketIdx = getSocketIndex(socket.id);
      const player = socketIdx ? room.players[socketIdx.playerId] : undefined;
      if (!player) return cb({ ok: false, error: 'Player not found' });
      if (!player.team) return cb({ ok: false, error: 'Choose a team first' });

      const validRoles: PlayerRole[] = ['director', 'agent'];
      if (!validRoles.includes(data.role)) {
        return cb({ ok: false, error: 'Invalid role' });
      }

      if (data.role === 'director') {
        const existingDirector = Object.values(room.players).find(
          (otherPlayer) =>
            otherPlayer.team === player.team &&
            otherPlayer.role === 'director' &&
            otherPlayer.id !== player.id
        );

        if (existingDirector) {
          return cb({
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
            return cb({
              ok: false,
              error: 'Cannot demote another director from your seat',
            });
          }
        }
      }

      player.role = data.role;

      broadcastRoom(nsp, room);
      cb({ ok: true });
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
        throw err;
      }
    });

    socket.on('giveSignal', (data, cb) => {
      const room = getRoom(data.roomCode);
      if (!room) return cb({ ok: false, error: 'Room not found' });
      if (room.phase !== 'playing') return cb({ ok: false, error: 'Game not in progress' });
      if (room.turnPhase !== 'giving-signal') return cb({ ok: false, error: 'Not signal phase' });

      const socketIdx = getSocketIndex(socket.id);
      const player = socketIdx ? room.players[socketIdx.playerId] : undefined;
      if (!player) return cb({ ok: false, error: 'Player not found' });
      if (player.team !== room.currentTurnTeam) return cb({ ok: false, error: 'Not your turn' });
      if (player.role !== 'director') return cb({ ok: false, error: 'Only director can signal' });

      const word = data.word?.trim().toUpperCase();
      if (!word || word.includes(' ')) {
        return cb({ ok: false, error: 'Signal must be a single word' });
      }

      const matchesBoard = room.board.some((card) => !card.revealed && card.word === word);
      if (matchesBoard) {
        return cb({ ok: false, error: 'Signal cannot match a word on the board' });
      }

      if (data.number < MIN_SIGNAL_NUMBER || data.number > MAX_SIGNAL_NUMBER) {
        return cb({
          ok: false,
          error: `Number must be ${MIN_SIGNAL_NUMBER}-${MAX_SIGNAL_NUMBER}`,
        });
      }

      giveSignal(room, word, data.number);
      broadcastRoom(nsp, room);
      cb({ ok: true });
    });

    socket.on('revealCard', (data, cb) => {
      const room = getRoom(data.roomCode);
      if (!room) return cb({ ok: false, error: 'Room not found' });
      if (room.phase !== 'playing') return cb({ ok: false, error: 'Game not in progress' });
      if (room.turnPhase !== 'guessing') return cb({ ok: false, error: 'Not guessing phase' });

      const socketIdx = getSocketIndex(socket.id);
      const player = socketIdx ? room.players[socketIdx.playerId] : undefined;
      if (!player) return cb({ ok: false, error: 'Player not found' });
      if (player.team !== room.currentTurnTeam) return cb({ ok: false, error: 'Not your turn' });
      if (player.role !== 'agent') return cb({ ok: false, error: 'Only agents can guess' });

      if (data.cardIndex < 0 || data.cardIndex >= BOARD_SIZE) {
        return cb({ ok: false, error: 'Invalid card index' });
      }

      const card = room.board[data.cardIndex];
      if (card.revealed) return cb({ ok: false, error: 'Card already revealed' });

      const result = processGuess(room, data.cardIndex, player.team!);

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
      cb({ ok: true });
    });

    socket.on('endTurn', (data, cb) => {
      const room = getRoom(data.roomCode);
      if (!room) return cb({ ok: false, error: 'Room not found' });
      if (room.phase !== 'playing') return cb({ ok: false, error: 'Game not in progress' });
      if (room.turnPhase !== 'guessing') return cb({ ok: false, error: 'Not guessing phase' });

      const socketIdx = getSocketIndex(socket.id);
      const player = socketIdx ? room.players[socketIdx.playerId] : undefined;
      if (!player) return cb({ ok: false, error: 'Player not found' });
      if (player.team !== room.currentTurnTeam) return cb({ ok: false, error: 'Not your turn' });
      if (player.role !== 'agent') return cb({ ok: false, error: 'Only agents can end turn' });

      addLogEntry(room, 'voluntary');
      advanceToNextTeam(room);
      broadcastRoom(nsp, room);
      cb({ ok: true });
    });

    socket.on('skipGuessRound', (data, cb) => {
      const room = getRoom(data.roomCode);
      if (!room) return cb({ ok: false, error: 'Room not found' });
      if (room.phase !== 'playing') return cb({ ok: false, error: 'Game not in progress' });
      if (!room.turnPhase) return cb({ ok: false, error: 'No active turn to skip' });
      if (!verifyPlayer(socket, data.roomCode, room.hostId ?? ''))
        return cb({ ok: false, error: 'Only host can skip' });

      if (room.turnPhase === 'guessing') {
        addLogEntry(room, 'voluntary');
      }
      advanceToNextTeam(room);
      broadcastRoom(nsp, room);
      cb({ ok: true });
    });

    socket.on('restartGame', (data, cb) => {
      const room = getRoom(data.roomCode);
      if (!room) return cb({ ok: false, error: 'Room not found' });
      if (!verifyPlayer(socket, data.roomCode, room.hostId ?? '')) {
        socketLogger.warn(
          { roomCode: data.roomCode, playerId: data.playerId },
          'restartGame rejected: actor is not secret-signals host'
        );
        return cb({ ok: false, error: 'Only host can restart' });
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
      cb({ ok: true });
    });

    socket.on('disconnect', (reason) => {
      setNamespaceConnectionCount({ namespace, gameId: GAME_ID }, nsp.sockets.size);
      const instrumentation = startSocketHandlerInstrumentation(namespace, 'disconnect');
      try {
        const index = getSocketIndex(socket.id);
        if (!index) {
          socketLogger.debug({ reason }, 'secret-signals client disconnected before room binding');
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
        instrumentation.finishSuccess();
      } catch (err) {
        instrumentation.finishError();
        throw err;
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
