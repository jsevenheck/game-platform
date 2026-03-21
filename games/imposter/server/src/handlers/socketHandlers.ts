import type { Server, Socket } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '../../../core/src/events';
import type { Room } from '../../../core/src/types';
import { MIN_PLAYERS } from '../../../core/src/constants';
import { GUESS_TIMEOUT_MS } from '../config/constants';
import {
  createRoom,
  getRoom,
  deleteRoom,
  clearRoomCleanup,
  scheduleRoomCleanup,
  getSessionRoom,
  setSessionRoom,
  setHost,
} from '../models/room';
import { persistWord } from '../utils/wordLibrary';
import { createPlayer, setSocketIndex, getSocketIndex, deleteSocketIndex } from '../models/player';
import { broadcastRoom, sendRoomToPlayer } from '../managers/broadcastManager';
import {
  setInfiltratorCount,
  setDiscussionDuration,
  setTargetScore,
  addWordToLibrary,
  startRound,
  submitDescription,
  submitVote as gameSubmitVote,
  allVotesSubmitted,
  startVoting,
  resolveVotes,
  handleInfiltratorGuess,
  skipGuess as doSkipGuess,
  skipCurrentDescription,
  resetForLobby,
  resetForNewRound,
  syncDescriptionTurn,
} from '../managers/gameManager';

const GAME_ID = 'imposter';

type GameSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

const discussionTimers = new Map<string, ReturnType<typeof setTimeout>>();
const guessTimers = new Map<string, ReturnType<typeof setTimeout>>();

function clearDiscussionTimer(roomCode: string): void {
  const timer = discussionTimers.get(roomCode);
  if (timer) {
    clearTimeout(timer);
    discussionTimers.delete(roomCode);
  }
}

function clearGuessTimer(roomCode: string): void {
  const timer = guessTimers.get(roomCode);
  if (timer) {
    clearTimeout(timer);
    guessTimers.delete(roomCode);
  }
}

export function clearRoomTimers(roomCode: string): void {
  clearDiscussionTimer(roomCode);
  clearGuessTimer(roomCode);
}

function verifyPlayer(socket: GameSocket, roomCode: string, playerId: string): boolean {
  const idx = getSocketIndex(socket.id);
  return idx !== undefined && idx.roomCode === roomCode && idx.playerId === playerId;
}

function restoreOwnerAsHost(room: Room): void {
  const owner = room.players[room.ownerId];
  if (owner?.connected && room.hostId !== owner.id) {
    setHost(room, owner.id);
  }
}

function reassignHostAfterDeparture(room: Room, departedPlayerId: string): void {
  if (room.hostId !== departedPlayerId) {
    return;
  }

  const nextHost = Object.values(room.players).find((candidate) => candidate.connected);
  setHost(room, nextHost?.id ?? null);
}

function handleVoluntaryDisconnect(room: Room, playerId: string): void {
  const player = room.players[playerId];
  if (!player) {
    return;
  }

  player.connected = false;
  player.socketId = null;

  if (room.phase === 'description') {
    syncDescriptionTurn(room);
  }

  reassignHostAfterDeparture(room, player.id);
  restoreOwnerAsHost(room);
}

function removePlayerFromRoom(room: Room, playerId: string): void {
  delete room.players[playerId];
  room.descriptionOrder = room.descriptionOrder.filter((id) => id !== playerId);
  delete room.descriptions[playerId];
  delete room.votes[playerId];
  room.infiltratorIds = room.infiltratorIds.filter((id) => id !== playerId);
  room.revealedInfiltrators = room.revealedInfiltrators.filter((id) => id !== playerId);

  for (const [voterId, targetId] of Object.entries(room.votes)) {
    if (targetId === playerId) {
      delete room.votes[voterId];
    }
  }

  if (room.currentDescriberId === playerId) {
    room.currentDescriberId = null;
  }
}

export function registerGame(io: Server, namespace = `/g/${GAME_ID}`): void {
  const nsp = io.of(namespace);

  nsp.use((socket, next) => {
    const auth = socket.handshake.auth || {};
    socket.data.sessionId = auth.sessionId;
    socket.data.joinToken = auth.joinToken || auth.token;
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
        if (matchingDisconnectedPlayer.id === room.ownerId) {
          setHost(room, matchingDisconnectedPlayer.id);
        } else if (matchingDisconnectedPlayer.isHost && room.hostId === null) {
          setHost(room, matchingDisconnectedPlayer.id);
        }
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
        setSessionRoom(sessionId, room.code);
        socket.join(room.code);
        broadcastRoom(nsp, room);
        return cb({ ok: true, roomCode: room.code, playerId: hostId, resumeToken });
      }

      if (hubPlayerId) {
        const existingPlayer = mappedRoom.players[hubPlayerId];
        if (existingPlayer) {
          // Require the server-issued resumeToken to prevent slot hijacking via public playerId.
          if (data.resumeToken && existingPlayer.resumeToken !== data.resumeToken) {
            return cb({ ok: false, error: 'Invalid resume token' });
          }
          if (!data.resumeToken && existingPlayer.resumeToken) {
            return cb({ ok: false, error: 'Resume token required' });
          }

          if (existingPlayer.socketId && existingPlayer.socketId !== socket.id) {
            deleteSocketIndex(existingPlayer.socketId);
          }

          existingPlayer.socketId = socket.id;
          existingPlayer.connected = true;
          if (existingPlayer.id === mappedRoom.ownerId || data.isHost) {
            setHost(mappedRoom, existingPlayer.id);
          } else if (existingPlayer.isHost && mappedRoom.hostId === null) {
            setHost(mappedRoom, existingPlayer.id);
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
      if (data.isHost) {
        setHost(mappedRoom, player.id);
      }
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
      if (player.id === room.ownerId) {
        setHost(room, player.id);
      } else if (player.isHost && room.hostId === null) {
        setHost(room, player.id);
      }
      setSocketIndex(socket.id, room.code, player.id);
      clearRoomCleanup(room.code);

      socket.join(room.code);
      broadcastRoom(nsp, room);
      cb({ ok: true });
    });

    socket.on('leaveRoom', (data, cb) => {
      if (!verifyPlayer(socket, data.roomCode, data.playerId)) {
        return cb({ ok: false, error: 'Unauthorized' });
      }

      const room = getRoom(data.roomCode);
      if (!room) {
        return cb({ ok: false, error: 'Room not found' });
      }

      const player = room.players[data.playerId];
      if (!player) {
        return cb({ ok: false, error: 'Player not found' });
      }

      socket.leave(data.roomCode);
      deleteSocketIndex(socket.id);

      if (room.phase !== 'lobby' && room.phase !== 'ended') {
        handleVoluntaryDisconnect(room, data.playerId);

        const anyConnected = Object.values(room.players).some((candidate) => candidate.connected);
        if (!anyConnected) {
          scheduleRoomCleanup(room.code);
        }

        broadcastRoom(nsp, room);
        return cb({ ok: true });
      }

      removePlayerFromRoom(room, data.playerId);

      if (Object.keys(room.players).length === 0) {
        clearDiscussionTimer(room.code);
        clearGuessTimer(room.code);
        deleteRoom(room.code);
        return cb({ ok: true });
      }

      if (room.ownerId === data.playerId) {
        room.ownerId =
          room.hostId && room.players[room.hostId]
            ? room.hostId
            : Object.values(room.players)[0]!.id;
      }

      if (room.hostId === data.playerId || !room.hostId || !room.players[room.hostId]) {
        setHost(room, room.ownerId);
      }

      broadcastRoom(nsp, room);
      cb({ ok: true });
    });

    socket.on('kickPlayer', (data, cb) => {
      if (!verifyPlayer(socket, data.roomCode, data.playerId)) {
        return cb({ ok: false, error: 'Unauthorized' });
      }

      const room = getRoom(data.roomCode);
      if (!room) return cb({ ok: false, error: 'Room not found' });
      if (room.hostId !== data.playerId) {
        return cb({ ok: false, error: 'Only host can kick players' });
      }
      if (room.phase !== 'lobby') {
        return cb({ ok: false, error: 'Can only kick players in the lobby' });
      }
      if (data.targetId === data.playerId) {
        return cb({ ok: false, error: 'Host cannot kick themselves' });
      }

      const target = room.players[data.targetId];
      if (!target) {
        return cb({ ok: false, error: 'Player not found' });
      }

      const kickedSocket = target.socketId ? nsp.sockets.get(target.socketId) : undefined;
      if (target.socketId) {
        deleteSocketIndex(target.socketId);
      }
      kickedSocket?.leave(room.code);
      kickedSocket?.emit('kicked', 'You were removed from the lobby');

      removePlayerFromRoom(room, data.targetId);

      if (Object.keys(room.players).length === 0) {
        clearDiscussionTimer(room.code);
        clearGuessTimer(room.code);
        deleteRoom(room.code);
        return cb({ ok: true });
      }

      broadcastRoom(nsp, room);
      cb({ ok: true });
    });

    socket.on('requestState', (data) => {
      if (!verifyPlayer(socket, data.roomCode, data.playerId)) return;
      const room = getRoom(data.roomCode);
      if (!room) return;
      sendRoomToPlayer(nsp, room, data.playerId);
    });

    socket.on('configureLobby', (data, cb) => {
      if (!verifyPlayer(socket, data.roomCode, data.playerId)) {
        return cb({ ok: false, error: 'Unauthorized' });
      }
      const room = getRoom(data.roomCode);
      if (!room) return cb({ ok: false, error: 'Room not found' });
      if (room.hostId !== data.playerId) return cb({ ok: false, error: 'Only host can configure' });
      if (room.phase !== 'lobby') return cb({ ok: false, error: 'Can only configure in lobby' });

      const previousConfig = {
        infiltratorCount: room.infiltratorCount,
        discussionDurationMs: room.discussionDurationMs,
        targetScore: room.targetScore,
      };

      const infiltratorError = setInfiltratorCount(room, data.infiltratorCount);
      if (infiltratorError) {
        return cb({ ok: false, error: infiltratorError });
      }

      if (data.discussionDurationMs !== room.discussionDurationMs) {
        const timerError = setDiscussionDuration(room, data.discussionDurationMs);
        if (timerError) {
          room.infiltratorCount = previousConfig.infiltratorCount;
          return cb({ ok: false, error: timerError });
        }
      }

      if (data.targetScore !== room.targetScore) {
        const targetError = setTargetScore(room, data.targetScore);
        if (targetError) {
          room.infiltratorCount = previousConfig.infiltratorCount;
          room.discussionDurationMs = previousConfig.discussionDurationMs;
          return cb({ ok: false, error: targetError });
        }
      }

      broadcastRoom(nsp, room);
      cb({ ok: true });
    });

    socket.on('submitWord', (data, cb) => {
      if (!verifyPlayer(socket, data.roomCode, data.playerId)) {
        return cb({ ok: false, error: 'Unauthorized' });
      }
      const room = getRoom(data.roomCode);
      if (!room) return cb({ ok: false, error: 'Room not found' });
      if (!room.players[data.playerId]) return cb({ ok: false, error: 'Player not found' });
      if (room.phase !== 'lobby') return cb({ ok: false, error: 'Can only submit words in lobby' });

      const err = addWordToLibrary(room, data.word);
      if (err) return cb({ ok: false, error: err });

      persistWord(data.word.trim());
      broadcastRoom(nsp, room);
      cb({ ok: true });
    });

    socket.on('startGame', (data, cb) => {
      if (!verifyPlayer(socket, data.roomCode, data.playerId)) {
        return cb({ ok: false, error: 'Unauthorized' });
      }
      const room = getRoom(data.roomCode);
      if (!room) return cb({ ok: false, error: 'Room not found' });
      if (room.hostId !== data.playerId) return cb({ ok: false, error: 'Only host can start' });
      if (room.phase !== 'lobby') return cb({ ok: false, error: 'Game already started' });

      const connected = Object.values(room.players).filter((player) => player.connected);
      if (connected.length < MIN_PLAYERS) {
        return cb({ ok: false, error: `Need at least ${MIN_PLAYERS} players` });
      }

      if (room.infiltratorCount >= connected.length) {
        return cb({ ok: false, error: 'Infiltrator count must be less than player count' });
      }

      startRound(room);
      broadcastRoom(nsp, room);
      cb({ ok: true });
    });

    socket.on('submitDescription', (data, cb) => {
      if (!verifyPlayer(socket, data.roomCode, data.playerId)) {
        return cb({ ok: false, error: 'Unauthorized' });
      }
      const room = getRoom(data.roomCode);
      if (!room) return cb({ ok: false, error: 'Room not found' });

      const err = submitDescription(room, data.playerId, data.description);
      if (err) return cb({ ok: false, error: err });

      if (room.phase === 'discussion') {
        room.discussionEndsAt = Date.now() + room.discussionDurationMs;
        clearDiscussionTimer(room.code);

        const timer = setTimeout(() => {
          if (room.phase === 'discussion') {
            startVoting(room);
            broadcastRoom(nsp, room);
          }
          discussionTimers.delete(room.code);
        }, room.discussionDurationMs);

        discussionTimers.set(room.code, timer);
      }

      broadcastRoom(nsp, room);
      cb({ ok: true });
    });

    socket.on('skipDescriptionTurn', (data, cb) => {
      if (!verifyPlayer(socket, data.roomCode, data.playerId)) {
        return cb({ ok: false, error: 'Unauthorized' });
      }
      const room = getRoom(data.roomCode);
      if (!room) return cb({ ok: false, error: 'Room not found' });
      if (room.hostId !== data.playerId) {
        return cb({ ok: false, error: 'Only host can skip clue turns' });
      }

      const err = skipCurrentDescription(room);
      if (err) return cb({ ok: false, error: err });

      if (room.phase === 'discussion') {
        room.discussionEndsAt = Date.now() + room.discussionDurationMs;
        clearDiscussionTimer(room.code);

        const timer = setTimeout(() => {
          if (room.phase === 'discussion') {
            startVoting(room);
            broadcastRoom(nsp, room);
          }
          discussionTimers.delete(room.code);
        }, room.discussionDurationMs);

        discussionTimers.set(room.code, timer);
      }

      broadcastRoom(nsp, room);
      cb({ ok: true });
    });

    socket.on('submitVote', (data, cb) => {
      if (!verifyPlayer(socket, data.roomCode, data.playerId)) {
        return cb({ ok: false, error: 'Unauthorized' });
      }
      const room = getRoom(data.roomCode);
      if (!room) return cb({ ok: false, error: 'Room not found' });

      const err = gameSubmitVote(room, data.playerId, data.targetId);
      if (err) return cb({ ok: false, error: err });

      if (allVotesSubmitted(room)) {
        resolveVotes(room);

        if (room.waitingForGuess) {
          clearGuessTimer(room.code);
          const timer = setTimeout(() => {
            if (room.waitingForGuess) {
              doSkipGuess(room);
              broadcastRoom(nsp, room);
            }
            guessTimers.delete(room.code);
          }, GUESS_TIMEOUT_MS);
          guessTimers.set(room.code, timer);
        }
      }

      broadcastRoom(nsp, room);
      cb({ ok: true });
    });

    socket.on('guessWord', (data, cb) => {
      if (!verifyPlayer(socket, data.roomCode, data.playerId)) {
        return cb({ ok: false, error: 'Unauthorized' });
      }
      const room = getRoom(data.roomCode);
      if (!room) return cb({ ok: false, error: 'Room not found' });

      if (!room.revealedInfiltrators.includes(data.playerId)) {
        return cb({ ok: false, error: 'Only caught infiltrators can guess' });
      }

      const err = handleInfiltratorGuess(room, data.guess);
      if (err) return cb({ ok: false, error: err });

      clearGuessTimer(room.code);
      broadcastRoom(nsp, room);
      cb({ ok: true });
    });

    socket.on('skipGuess', (data, cb) => {
      if (!verifyPlayer(socket, data.roomCode, data.playerId)) {
        return cb({ ok: false, error: 'Unauthorized' });
      }
      const room = getRoom(data.roomCode);
      if (!room) return cb({ ok: false, error: 'Room not found' });
      if (room.hostId !== data.playerId) {
        return cb({ ok: false, error: 'Only host can skip the guess' });
      }
      if (room.phase !== 'reveal') return cb({ ok: false, error: 'Can only skip in reveal phase' });
      if (!room.waitingForGuess) return cb({ ok: false, error: 'Not waiting for a guess' });

      clearGuessTimer(room.code);
      doSkipGuess(room);
      broadcastRoom(nsp, room);
      cb({ ok: true });
    });

    socket.on('nextRound', (data, cb) => {
      if (!verifyPlayer(socket, data.roomCode, data.playerId)) {
        return cb({ ok: false, error: 'Unauthorized' });
      }
      const room = getRoom(data.roomCode);
      if (!room) return cb({ ok: false, error: 'Room not found' });
      if (room.hostId !== data.playerId) {
        return cb({ ok: false, error: 'Only host can start next round' });
      }
      if (room.phase !== 'reveal') return cb({ ok: false, error: 'Can only advance from reveal' });

      clearGuessTimer(room.code);
      resetForNewRound(room);
      startRound(room);
      broadcastRoom(nsp, room);
      cb({ ok: true });
    });

    socket.on('endGame', (data, cb) => {
      if (!verifyPlayer(socket, data.roomCode, data.playerId)) {
        return cb({ ok: false, error: 'Unauthorized' });
      }
      const room = getRoom(data.roomCode);
      if (!room) return cb({ ok: false, error: 'Room not found' });
      if (room.hostId !== data.playerId) return cb({ ok: false, error: 'Only host can end game' });
      if (room.phase !== 'reveal') return cb({ ok: false, error: 'Can only end game from reveal' });

      clearGuessTimer(room.code);
      room.phase = 'ended';
      broadcastRoom(nsp, room);
      cb({ ok: true });
    });

    socket.on('restartGame', (data, cb) => {
      if (!verifyPlayer(socket, data.roomCode, data.playerId)) {
        return cb({ ok: false, error: 'Unauthorized' });
      }
      const room = getRoom(data.roomCode);
      if (!room) return cb({ ok: false, error: 'Room not found' });
      if (room.hostId !== data.playerId) return cb({ ok: false, error: 'Only host can restart' });

      clearDiscussionTimer(room.code);
      clearGuessTimer(room.code);
      resetForLobby(room);
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
          handleVoluntaryDisconnect(room, player.id);

          const anyConnected = Object.values(room.players).some((candidate) => candidate.connected);
          if (!anyConnected) {
            scheduleRoomCleanup(room.code);
          }

          broadcastRoom(nsp, room);
        }
      }
      deleteSocketIndex(socket.id);
    });
  });
}
