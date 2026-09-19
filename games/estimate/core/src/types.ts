export type Phase = 'lobby' | 'guessing' | 'allSubmitted' | 'reveal' | 'ended';

export interface Question {
  id: string;
  text: string;
  answer: number;
}

export interface PlayerView {
  id: string;
  name: string;
  isHost: boolean;
  connected: boolean;
  hasSubmitted: boolean;
}

export interface GuessEntry {
  playerId: string;
  guess: number;
}

export interface WinnerEntry {
  playerId: string;
  name: string;
}

export interface ScoreEntry {
  playerId: string;
  name: string;
  points: number;
}

export interface DisplayRange {
  lo: number;
  hi: number;
}

export interface RoomView {
  roomCode: string;
  phase: Phase;
  currentRound: number;
  totalRounds: number;
  question: { id: string; text: string } | null;
  players: PlayerView[];
  guesses: GuessEntry[];
  solution: number | null;
  winners: WinnerEntry[];
  scores: ScoreEntry[];
  displayRange: DisplayRange | null;
}

export interface ServerPlayer {
  id: string;
  name: string;
  socketId: string;
  isHost: boolean;
  connected: boolean;
  resumeToken: string;
}

export interface ServerRoom {
  roomCode: string;
  matchKey: string;
  hostPlayerId: string;
  phase: Phase;
  currentRound: number;
  totalRounds: number;
  question: Question | null;
  questionDeck: Question[];
  players: ServerPlayer[];
  guesses: Map<string, number>;
  scores: Map<string, number>;
  displayRange: DisplayRange | null;
}

export interface StoredSession {
  playerId: string;
  roomCode: string;
  name: string;
  resumeToken: string;
  /** Match key this game resume token belongs to. Older sessions may omit it. */
  sessionId?: string;
}
