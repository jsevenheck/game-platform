export type Phase = 'lobby' | 'playing' | 'roundEnd' | 'ended';
export type Language = 'de' | 'en';

export interface Category {
  id: number;
  name: string;
}

export interface TaskRule {
  id: number;
  text: string;
  requiresLetter: boolean;
}

export interface RoundData {
  roundNumber: number;
  category: Category;
  task: TaskRule;
  letter: string | null;
  readerId: string;
  winnerId: string | null;
  revealed: boolean;
}

export interface Player {
  id: string;
  name: string;
  resumeToken: string;
  score: number;
  connected: boolean;
  isHost: boolean;
  socketId: string | null;
}

export interface Room {
  code: string;
  ownerId: string | null;
  hostId: string | null;
  phase: Phase;
  players: Record<string, Player>;
  language: Language;
  excludedLetters: string[];
  maxRounds: number;
  currentRound: RoundData | null;
  roundHistory: RoundResult[];
  usedCategoryLetterPairs: Set<string>;
}

export interface RoundResult {
  roundNumber: number;
  category: Category;
  task: TaskRule;
  letter: string | null;
  readerId: string;
  winnerId: string | null;
}

export interface RoomView {
  code: string;
  ownerId: string | null;
  phase: Phase;
  players: PlayerView[];
  language: Language;
  excludedLetters: string[];
  maxRounds: number;
  currentRound: RoundView | null;
  roundHistory: RoundResult[];
  usedCategoryIds: number[];
}

export interface PlayerView {
  id: string;
  name: string;
  score: number;
  connected: boolean;
  isHost: boolean;
}

export interface RoundView {
  roundNumber: number;
  category: Category | null;
  task: TaskRule | null;
  letter: string | null;
  readerId: string;
  winnerId: string | null;
  revealed: boolean;
}

export interface StoredSession {
  playerId: string;
  roomCode: string;
  name: string;
  resumeToken: string;
}
