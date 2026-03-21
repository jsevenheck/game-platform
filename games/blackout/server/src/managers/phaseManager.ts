import type { Room } from '../../../core/src/types';

export function transitionToPlaying(room: Room): void {
  room.phase = 'playing';
}

export function transitionToRoundEnd(room: Room): void {
  room.phase = 'roundEnd';
}

export function transitionToEnded(room: Room): void {
  room.phase = 'ended';
}

export function transitionToLobby(room: Room): void {
  room.phase = 'lobby';
  room.currentRound = null;
  room.roundHistory = [];
  room.usedCategoryLetterPairs = new Set();
}
