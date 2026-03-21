import type { Room } from '../../../core/src/types';
import { initGameState, resetForLobby, resetForNewRound, startRound } from './gameManager';

export function transitionToPlaying(room: Room): void {
  startRound(room);
}

export function transitionToEnded(room: Room): void {
  room.phase = 'ended';
}

export function transitionToLobby(room: Room): void {
  resetForLobby(room);
}

export function transitionToNextRound(room: Room): void {
  resetForNewRound(room);
  startRound(room);
}

export { initGameState };
