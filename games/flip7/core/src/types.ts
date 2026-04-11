import type { Card } from './deck';

export type Phase = 'lobby' | 'playing' | 'roundEnd' | 'ended';

export interface Player {
  id: string;
  name: string;
  resumeToken: string;
  totalScore: number;
  connected: boolean;
  isHost: boolean;
  socketId: string | null;
}

export type RoundPlayerStatus = 'active' | 'stayed' | 'busted';

export interface RoundPlayer {
  playerId: string;
  status: RoundPlayerStatus;
  numberCards: number[];
  modifierAdds: number[];
  hasX2: boolean;
  hasSecondChance: boolean;
  flipThreeRemaining: number;
}

export interface PendingAction {
  drawerId: string;
  action: 'freeze' | 'flipThree' | 'secondChance';
  eligibleTargets: string[];
}

export interface RoundState {
  roundNumber: number;
  dealerIndex: number;
  turnOrder: string[];
  currentTurnIndex: number;
  deck: Card[];
  discard: Card[];
  players: Record<string, RoundPlayer>;
  pendingAction: PendingAction | null;
  roundEndReason: 'allDone' | 'flip7' | null;
  flip7PlayerId: string | null;
}

export interface Room {
  code: string;
  ownerId: string | null;
  hostId: string | null;
  phase: Phase;
  players: Record<string, Player>;
  targetScore: number;
  currentRound: RoundState | null;
  roundHistory: RoundHistoryEntry[];
  winnerIds: string[];
}

export interface RoundHistoryEntry {
  roundNumber: number;
  scores: Record<string, number>;
  flip7PlayerId: string | null;
}

// ─── Client-safe view types (strip secrets + raw deck order) ─────────────────

export interface PlayerView {
  id: string;
  name: string;
  totalScore: number;
  connected: boolean;
  isHost: boolean;
}

export interface RoundPlayerView {
  playerId: string;
  status: RoundPlayerStatus;
  numberCards: number[];
  modifierAdds: number[];
  hasX2: boolean;
  hasSecondChance: boolean;
  flipThreeRemaining: number;
}

export interface PendingActionView {
  drawerId: string;
  action: 'freeze' | 'flipThree' | 'secondChance';
  eligibleTargets: string[];
}

export interface RoundView {
  roundNumber: number;
  currentTurnPlayerId: string | null;
  deckSize: number;
  discardSize: number;
  players: RoundPlayerView[];
  pendingAction: PendingActionView | null;
  roundEndReason: 'allDone' | 'flip7' | null;
  flip7PlayerId: string | null;
}

export interface RoomView {
  code: string;
  ownerId: string | null;
  phase: Phase;
  players: PlayerView[];
  targetScore: number;
  currentRound: RoundView | null;
  roundHistory: RoundHistoryEntry[];
  winnerIds: string[];
}

export interface StoredSession {
  playerId: string;
  roomCode: string;
  name: string;
  resumeToken: string;
}
