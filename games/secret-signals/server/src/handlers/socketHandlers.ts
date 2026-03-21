import type { Server, Socket } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '../../../core/src/events';
import type { Card, LogEntry, PlayerRole, Room } from '../../../core/src/types';
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

export function registerGame(io: Server, namespace = `/g/${GAME_ID}`): void {
  const nsp = io.of(namespace);

  nsp.use((socket, next) => {
    const auth = socket.handshake.auth || {};
    socket.data.sessionId = auth.sessionId;
    socket.data.playerId = auth.playerId;
    next();
  });

  nsp.on('connection', (socket: GameSocket) => {
    socket.on('createRoom', (data, cb) => {
      const name = data.name?.trim();
      if (!name || name.length > 20) {
        return cb({ ok: false, error: 'Invalid name' });
      }

      const { room, hostId, resumeToken } = createRoom(name, socket.id);
      socket.join(room.code);
      broadcastRoom(nsp, room);

      cb({ ok: true, roomCode: room.code, playerId: hostId, resumeToken });
    });

    socket.on('joinRoom', (data, cb) => {
      const name = data.name?.trim();
      const code = data.code?.trim().toUpperCase();
      if (!name || name.length > 20) {
        return cb({ ok: false, error: 'Invalid name' });
      }

      const room = getRoom(code);
      if (!room) {
        return cb({ ok: false, error: 'Room not found' });
      }

      const matchingDisconnectedPlayer = Object.values(room.players).find(
        (player) => player.name.toLowerCase() === name.toLowerCase() && !player.connected
      );
      if (matchingDisconnectedPlayer) {
        matchingDisconnectedPlayer.socketId = socket.id;
        matchingDisconnectedPlayer.connected = true;
        setSocketIndex(socket.id, code, matchingDisconnectedPlayer.id);
        clearRoomCleanup(code);

        socket.join(code);
        broadcastRoom(nsp, room);

        return cb({
          ok: true,
          playerId: matchingDisconnectedPlayer.id,
          resumeToken: matchingDisconnectedPlayer.resumeToken,
        });
      }

      if (room.phase !== 'lobby') {
        return cb({ ok: false, error: 'Game already started' });
      }

      const nameExists = Object.values(room.players).some(
        (player) => player.name.toLowerCase() === name.toLowerCase()
      );
      if (nameExists) {
        return cb({ ok: false, error: 'Name already taken' });
      }

      const player = createPlayer(name, false);
      player.socketId = socket.id;
      room.players[player.id] = player;
      setSocketIndex(socket.id, code, player.id);
      clearRoomCleanup(code);

      socket.join(code);
      broadcastRoom(nsp, room);

      cb({ ok: true, playerId: player.id, resumeToken: player.resumeToken });
    });

    socket.on('autoJoinRoom', (data, cb) => {
      const sessionId = data.sessionId?.trim();
      const name = data.name?.trim();
      const hubPlayerId = data.playerId?.trim();

      if (!sessionId || !name) {
        return cb({ ok: false, error: 'Missing session info' });
      }

      const mappedRoomCode = getSessionRoom(sessionId);
      const mappedRoom = mappedRoomCode ? getRoom(mappedRoomCode) : undefined;

      if (!mappedRoom) {
        const { room, hostId, resumeToken } = createRoom(name, socket.id, hubPlayerId || undefined);
        setSessionToRoom(sessionId, room.code);
        socket.join(room.code);
        broadcastRoom(nsp, room);
        return cb({ ok: true, roomCode: room.code, playerId: hostId, resumeToken });
      }

      if (hubPlayerId) {
        const existingPlayer = mappedRoom.players[hubPlayerId];
        if (existingPlayer) {
          if (existingPlayer.socketId && existingPlayer.socketId !== socket.id) {
            deleteSocketIndex(existingPlayer.socketId);
          }
          existingPlayer.socketId = socket.id;
          existingPlayer.connected = true;
          if (existingPlayer.isHost) {
            mappedRoom.hostId = existingPlayer.id;
          }
          setSocketIndex(socket.id, mappedRoom.code, existingPlayer.id);
          clearRoomCleanup(mappedRoom.code);
          socket.join(mappedRoom.code);
          broadcastRoom(nsp, mappedRoom);
          return cb({
            ok: true,
            roomCode: mappedRoom.code,
            playerId: existingPlayer.id,
            resumeToken: existingPlayer.resumeToken,
          });
        }
      }

      if (mappedRoom.phase !== 'lobby') {
        return cb({ ok: false, error: 'Game already started' });
      }

      const nameExists = Object.values(mappedRoom.players).some(
        (player) => player.name.toLowerCase() === name.toLowerCase()
      );
      if (nameExists) {
        return cb({ ok: false, error: 'Name already taken' });
      }

      const player = createPlayer(name, false, hubPlayerId || undefined);
      player.socketId = socket.id;
      mappedRoom.players[player.id] = player;
      setSocketIndex(socket.id, mappedRoom.code, player.id);
      clearRoomCleanup(mappedRoom.code);
      socket.join(mappedRoom.code);
      broadcastRoom(nsp, mappedRoom);
      cb({
        ok: true,
        roomCode: mappedRoom.code,
        playerId: player.id,
        resumeToken: player.resumeToken,
      });
    });

    socket.on('resumePlayer', (data, cb) => {
      const room = getRoom(data.roomCode);
      if (!room) return cb({ ok: false, error: 'Room not found' });

      const player = room.players[data.playerId];
      if (!player) return cb({ ok: false, error: 'Player not found' });
      if (player.resumeToken !== data.resumeToken) {
        return cb({ ok: false, error: 'Invalid resume token' });
      }

      if (player.socketId) deleteSocketIndex(player.socketId);

      player.socketId = socket.id;
      player.connected = true;
      setSocketIndex(socket.id, room.code, player.id);
      clearRoomCleanup(room.code);

      socket.join(room.code);
      broadcastRoom(nsp, room);
      cb({ ok: true });
    });

    socket.on('requestState', (data) => {
      const room = getRoom(data.roomCode);
      if (!room || !room.players[data.playerId]) return;
      sendRoomToPlayer(nsp, room, data.playerId);
    });

    socket.on('leaveRoom', (data, cb) => {
      const room = getRoom(data.roomCode);
      if (!room) return cb({ ok: false, error: 'Room not found' });

      const player = room.players[data.playerId];
      if (!player) return cb({ ok: false, error: 'Player not found' });
      if (player.socketId !== socket.id) return cb({ ok: false, error: 'Unauthorized' });

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
        return cb({ ok: true });
      }

      removePlayerFromRoom(room, player.id);

      if (Object.keys(room.players).length === 0) {
        clearRoomCleanup(room.code);
        deleteRoom(room.code);
        return cb({ ok: true });
      }

      reassignHost(room, player.id);
      broadcastRoom(nsp, room);
      cb({ ok: true });
    });

    socket.on('setTeamCount', (data, cb) => {
      const room = getRoom(data.roomCode);
      if (!room) return cb({ ok: false, error: 'Room not found' });
      if (room.hostId !== data.playerId) return cb({ ok: false, error: 'Only host can change' });
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
      if (room.hostId !== data.playerId) return cb({ ok: false, error: 'Only host can change' });
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

      const player = room.players[data.playerId];
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

      const player = room.players[data.playerId];
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

      const player = room.players[data.playerId];
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
      const room = getRoom(data.roomCode);
      if (!room) return cb({ ok: false, error: 'Room not found' });
      if (room.hostId !== data.playerId) return cb({ ok: false, error: 'Only host can start' });
      if (room.phase !== 'lobby') return cb({ ok: false, error: 'Game already started' });

      const minimumPlayers = getMinimumPlayersForTeamCount(room.teamCount);
      const connected = Object.values(room.players).filter((player) => player.connected);
      if (connected.length < minimumPlayers) {
        return cb({ ok: false, error: `Need at least ${minimumPlayers} players` });
      }

      const validation = validateTeamSetup(room);
      if (!validation.valid) {
        return cb({ ok: false, error: validation.error! });
      }

      transitionToPlaying(room);
      broadcastRoom(nsp, room);
      cb({ ok: true });
    });

    socket.on('giveSignal', (data, cb) => {
      const room = getRoom(data.roomCode);
      if (!room) return cb({ ok: false, error: 'Room not found' });
      if (room.phase !== 'playing') return cb({ ok: false, error: 'Game not in progress' });
      if (room.turnPhase !== 'giving-signal') return cb({ ok: false, error: 'Not signal phase' });

      const player = room.players[data.playerId];
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

      const player = room.players[data.playerId];
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

      const player = room.players[data.playerId];
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
      if (room.hostId !== data.playerId) return cb({ ok: false, error: 'Only host can skip' });

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
      if (room.hostId !== data.playerId) return cb({ ok: false, error: 'Only host can restart' });

      transitionToLobby(room);
      broadcastRoom(nsp, room);
      cb({ ok: true });
    });

    socket.on('disconnect', () => {
      const index = getSocketIndex(socket.id);
      if (!index) return;

      const room = getRoom(index.roomCode);
      if (room) {
        const player = room.players[index.playerId];
        if (player) {
          player.connected = false;
          player.socketId = null;
          room.focusedCards = room.focusedCards.filter((marker) => marker.playerId !== player.id);
          broadcastRoom(nsp, room);
        }
      }
      deleteSocketIndex(socket.id);
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
