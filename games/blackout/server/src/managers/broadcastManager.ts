import type { Namespace } from 'socket.io';
import type { Room, RoomView, RoundView, PlayerView } from '../../../core/src/types';
import type { ClientToServerEvents, ServerToClientEvents } from '../../../core/src/events';

type BlackoutNamespace = Namespace<ClientToServerEvents, ServerToClientEvents>;

function toPlayerView(room: Room): PlayerView[] {
  return Object.values(room.players).map((p) => ({
    id: p.id,
    name: p.name,
    score: p.score,
    connected: p.connected,
    isHost: p.isHost,
  }));
}

function toRoundView(room: Room, playerId: string): RoundView | null {
  const round = room.currentRound;
  if (!round) return null;

  const isReader = room.hostId === playerId;
  const showCategory = isReader || round.revealed;

  return {
    roundNumber: round.roundNumber,
    category: showCategory ? round.category : null,
    task: showCategory ? round.task : null,
    letter: showCategory ? round.letter : null,
    readerId: round.readerId,
    winnerId: round.winnerId,
    revealed: round.revealed,
  };
}

function toRoomView(room: Room, playerId: string): RoomView {
  const usedCategoryIds = [...new Set(room.roundHistory.map((r) => r.category.id))];
  return {
    code: room.code,
    ownerId: room.ownerId,
    phase: room.phase,
    players: toPlayerView(room),
    language: room.language,
    excludedLetters: room.excludedLetters,
    maxRounds: room.maxRounds,
    currentRound: toRoundView(room, playerId),
    roundHistory: room.roundHistory,
    usedCategoryIds,
  };
}

export function broadcastRoom(nsp: BlackoutNamespace, room: Room): void {
  for (const player of Object.values(room.players)) {
    if (player.socketId && player.connected) {
      const view = toRoomView(room, player.id);
      nsp.to(player.socketId).emit('roomUpdate', view);
    }
  }
}

export function sendRoomToPlayer(nsp: BlackoutNamespace, room: Room, playerId: string): void {
  const player = room.players[playerId];
  if (player?.socketId && player.connected) {
    const view = toRoomView(room, playerId);
    nsp.to(player.socketId).emit('roomUpdate', view);
  }
}
