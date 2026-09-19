export type Phase = 'lobby' | 'answering' | 'allSubmitted' | 'reveal' | 'ended';

export interface Prompt {
  id: string;
  text: string;
}

export interface PlayerView {
  id: string;
  name: string;
  isHost: boolean;
  connected: boolean;
  hasSubmitted: boolean;
}

export interface AnswerEntry {
  playerId: string;
  answer: string;
}

export interface AnswerGroup {
  answer: string;
  playerIds: string[];
  playerNames: string[];
  count: number;
}

export interface WinnerEntry {
  playerId: string;
  name: string;
}

export interface ScoreEntry {
  playerId: string;
  name: string;
  cows: number;
  hasPinkCow: boolean;
}

export interface RoundResult {
  groups: AnswerGroup[];
  unmatchedPlayerIds: string[];
  pinkCowPlayerId: string | null;
  winnerIds: string[];
}

export interface RoomView {
  roomCode: string;
  phase: Phase;
  currentRound: number;
  totalRounds: number;
  prompt: { id: string; text: string } | null;
  players: PlayerView[];
  answers: AnswerEntry[];
  result: RoundResult | null;
  winners: WinnerEntry[];
  scores: ScoreEntry[];
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
  prompt: Prompt | null;
  promptDeck: Prompt[];
  players: ServerPlayer[];
  answers: Map<string, string>;
  cows: Map<string, number>;
  pinkCowPlayerId: string | null;
  roundResult: RoundResult | null;
}

export interface StoredSession {
  playerId: string;
  roomCode: string;
  name: string;
  resumeToken: string;
  sessionId?: string;
}
