import type { Room } from '../../../core/src/types';

export function transitionToPlaying(room: Room): void {
  room.phase = 'playing';
}

export function transitionToRoundEnd(room: Room): void {
  room.phase = 'roundEnd';
}

export function transitionToEnded(room: Room, winnerIds: string[]): void {
  room.phase = 'ended';
  room.winnerIds = winnerIds;
}

export function transitionToLobby(room: Room): void {
  room.phase = 'lobby';
  room.currentRound = null;
  room.roundHistory = [];
  room.winnerIds = [];
  for (const player of Object.values(room.players)) {
    player.totalScore = 0;
  }
}
