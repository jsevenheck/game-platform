import type { Namespace } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '../../../core/src/events';
import type { PlayerView, Room, RoomView, TrickView } from '../../../core/src/types';
import { currentTurnPlayerId, setupComplete } from './trickManager';

type ScoutNamespace = Namespace<ClientToServerEvents, ServerToClientEvents>;

function toPlayerViews(room: Room, viewerId: string): PlayerView[] {
  return room.playerOrder.map((playerId) => {
    const player = room.players[playerId];
    return {
      id: player.id,
      name: player.name,
      connected: player.connected,
      isHost: player.isHost,
      rowCount: player.row.length,
      takenCount: player.takenPile.length,
      setupConfirmed: player.setupConfirmed,
      score: player.score,
      row: player.id === viewerId ? [...player.row] : null,
    };
  });
}

function toTrickView(room: Room): TrickView | null {
  const trick = room.trick;
  if (!trick) return null;
  return {
    trickNumber: trick.trickNumber,
    leaderId: trick.leaderId,
    currentTurnPlayerId: room.phase === 'playing' ? currentTurnPlayerId(trick) : null,
    passedPlayerIds: [...trick.passedPlayerIds],
    plays: trick.plays.map((play) => ({ ...play, cards: [...play.cards] })),
    currentPlay: trick.currentPlay
      ? { ...trick.currentPlay, cards: [...trick.currentPlay.cards] }
      : null,
  };
}

export function toRoomView(room: Room, viewerId: string): RoomView {
  return {
    code: room.code,
    ownerId: room.ownerId,
    phase: room.phase,
    players: toPlayerViews(room, viewerId),
    playerOrder: [...room.playerOrder],
    showPile: [...room.showPile],
    setupComplete: setupComplete(room),
    trick: toTrickView(room),
    trickHistory: [...room.trickHistory],
    winnerIds: [...room.winnerIds],
    gameEndReason: room.gameEndReason,
  };
}

export function broadcastRoom(nsp: ScoutNamespace, room: Room): void {
  for (const player of Object.values(room.players)) {
    if (player.socketId && player.connected) {
      nsp.to(player.socketId).emit('roomUpdate', toRoomView(room, player.id));
    }
  }
}

export function sendRoomToPlayer(nsp: ScoutNamespace, room: Room, playerId: string): void {
  const player = room.players[playerId];
  if (player?.socketId && player.connected) {
    nsp.to(player.socketId).emit('roomUpdate', toRoomView(room, player.id));
  }
}
