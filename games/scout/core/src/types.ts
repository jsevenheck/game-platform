import type { ScoutCard } from './deck';
import type { PlayKind } from './analyzePlay';

export type GamePhase = 'lobby' | 'playing' | 'ended';
export type RoundEndReason = 'handEmpty' | 'allScouted';

export interface Player {
  id: string;
  name: string;
  resumeToken: string;
  connected: boolean;
  isHost: boolean;
  socketId: string | null;
  row: ScoutCard[];
  /** Cards won by beating a prior set during the current round. */
  takenPile: ScoutCard[];
  setupFlipped: boolean;
  setupConfirmed: boolean;
  /** Total score across completed rounds. */
  score: number;
  /** Most recent completed round score. */
  roundScore: number;
  /** Score tokens gained when this player's prior set is scouted (3-5p rules). */
  scoutTokens: number;
  /** Remaining Scout & Show uses for this round: 1 in 3-5p, 3 in 2p variant. */
  scoutAndShowTokens: number;
}

export interface PlayedSet {
  id: string;
  playerId: string;
  cards: ScoutCard[];
  kind: PlayKind;
  count: number;
  highCard: number;
  lowCard: number;
}

export interface TrickState {
  trickNumber: number;
  leaderId: string;
  turnOrder: string[];
  currentTurnIndex: number;
  /** Players who scouted instead of showing against the current prior set. */
  scoutedPlayerIds: string[];
  /** Kept for UI/history display; contains the current prior set when present. */
  plays: PlayedSet[];
  currentPlay: PlayedSet | null;
  /** Owner of the prior set, retained even if its last card was scouted. */
  priorSetOwnerId: string | null;
}

export interface TrickHistoryEntry {
  trickNumber: number;
  winnerId: string;
  cardCount: number;
  points: number;
}

export interface RoundHistoryEntry {
  roundNumber: number;
  endingPlayerId: string;
  reason: RoundEndReason;
  scores: Record<string, number>;
}

export interface Room {
  code: string;
  ownerId: string | null;
  hostId: string | null;
  phase: GamePhase;
  players: Record<string, Player>;
  playerOrder: string[];
  /** Unused by official rules; retained as an empty array for backward-safe clients. */
  showPile: ScoutCard[];
  trick: TrickState | null;
  trickHistory: TrickHistoryEntry[];
  roundHistory: RoundHistoryEntry[];
  roundNumber: number;
  totalRounds: number;
  roundStartPlayerIndex: number;
  twoPlayerReserve: ScoutCard[];
  winnerIds: string[];
  gameEndReason: RoundEndReason | null;
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
  roundScore: number;
  scoutTokens: number;
  scoutAndShowTokens: number;
  /** Only populated for the receiving player. */
  row: ScoutCard[] | null;
}

export interface PlayedSetView {
  id: string;
  playerId: string;
  cards: ScoutCard[];
  kind: PlayKind;
  count: number;
  highCard: number;
  lowCard: number;
}

export interface TrickView {
  trickNumber: number;
  leaderId: string;
  currentTurnPlayerId: string | null;
  scoutedPlayerIds: string[];
  plays: PlayedSetView[];
  currentPlay: PlayedSetView | null;
  priorSetOwnerId: string | null;
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
  roundHistory: RoundHistoryEntry[];
  roundNumber: number;
  totalRounds: number;
  winnerIds: string[];
  gameEndReason: Room['gameEndReason'];
}

export interface StoredSession {
  playerId: string;
  roomCode: string;
  name: string;
  resumeToken: string;
}
