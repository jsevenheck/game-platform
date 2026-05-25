import type { ScoutCard } from './deck';

export type GamePhase = 'lobby' | 'playing' | 'ended';

export interface Player {
  id: string;
  name: string;
  resumeToken: string;
  connected: boolean;
  isHost: boolean;
  socketId: string | null;
  row: ScoutCard[];
  takenPile: ScoutCard[];
  setupFlipped: boolean;
  setupConfirmed: boolean;
  score: number;
}

export interface PlayedSet {
  id: string;
  playerId: string;
  cards: ScoutCard[];
  sum: number;
  count: number;
  highCard: number;
}

export interface TrickState {
  trickNumber: number;
  leaderId: string;
  turnOrder: string[];
  currentTurnIndex: number;
  passedPlayerIds: string[];
  plays: PlayedSet[];
  currentPlay: PlayedSet | null;
}

export interface TrickHistoryEntry {
  trickNumber: number;
  winnerId: string;
  cardCount: number;
  points: number;
}

export interface Room {
  code: string;
  ownerId: string | null;
  hostId: string | null;
  phase: GamePhase;
  players: Record<string, Player>;
  playerOrder: string[];
  showPile: ScoutCard[];
  trick: TrickState | null;
  trickHistory: TrickHistoryEntry[];
  winnerIds: string[];
  gameEndReason: 'rowEmpty' | null;
}

// ─── Client-safe view types ─────────────────────────────────────────────────

export interface PlayerView {
  id: string;
  name: string;
  connected: boolean;
  isHost: boolean;
  rowCount: number;
  takenCount: number;
  setupConfirmed: boolean;
  score: number;
  /** Only populated for the receiving player. */
  row: ScoutCard[] | null;
}

export interface PlayedSetView {
  id: string;
  playerId: string;
  cards: ScoutCard[];
  sum: number;
  count: number;
  highCard: number;
}

export interface TrickView {
  trickNumber: number;
  leaderId: string;
  currentTurnPlayerId: string | null;
  passedPlayerIds: string[];
  plays: PlayedSetView[];
  currentPlay: PlayedSetView | null;
}

export interface RoomView {
  code: string;
  ownerId: string | null;
  phase: GamePhase;
  players: PlayerView[];
  playerOrder: string[];
  showPile: ScoutCard[];
  setupComplete: boolean;
  trick: TrickView | null;
  trickHistory: TrickHistoryEntry[];
  winnerIds: string[];
  gameEndReason: Room['gameEndReason'];
}

export interface StoredSession {
  playerId: string;
  roomCode: string;
  name: string;
  resumeToken: string;
}
