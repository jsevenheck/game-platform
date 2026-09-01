export type Phase = 'lobby' | 'drawing' | 'voting' | 'agentGuess' | 'reveal' | 'ended';

export interface Topic {
  id: string;
  category: string;
  topic: string;
}

export interface StrokePoint {
  x: number;
  y: number;
}

export interface StrokeView {
  id: string;
  playerId: string;
  turn: number;
  points: StrokePoint[];
}

export interface PlayerView {
  id: string;
  name: string;
  isHost: boolean;
  connected: boolean;
  strokesSubmitted: number;
  hasVoted: boolean;
}

export interface VoteStatus {
  playerId: string;
  hasVoted: boolean;
}

export interface VoteCount {
  playerId: string;
  name: string;
  votes: number;
}

export interface ScoreEntry {
  playerId: string;
  name: string;
  points: number;
}

export interface RoundResult {
  agentId: string;
  agentCaught: boolean;
  agentGuessed: boolean | null;
  topic: string;
  scoreDeltas: Record<string, number>;
}

export interface RoomView {
  roomCode: string;
  phase: Phase;
  currentRound: number;
  totalRounds: number;
  category: string | null;
  strokes: StrokeView[];
  players: PlayerView[];
  votes: VoteStatus[];
  revealedAgentId: string | null;
  revealedTopic: string | null;
  voteCounts: VoteCount[];
  roundResult: RoundResult | null;
  scores: ScoreEntry[];
  drawingTurn: number;
  totalDrawingTurns: number;
  activePlayerId: string | null;
}

export interface PrivateAssignment {
  category: string;
  topic: string | null;
  isAgent: boolean;
}

export interface ServerPlayer {
  id: string;
  name: string;
  socketId: string;
  isHost: boolean;
  connected: boolean;
  resumeToken: string;
  strokesSubmitted: number;
  hasVoted: boolean;
}

export interface ServerRoom {
  roomCode: string;
  matchKey: string;
  hostPlayerId: string;
  phase: Phase;
  currentRound: number;
  totalRounds: number;
  topic: Topic | null;
  topicDeck: Topic[];
  agentId: string | null;
  players: ServerPlayer[];
  strokes: StrokeView[];
  votes: Map<string, string>;
  scores: Map<string, number>;
  roundResult: RoundResult | null;
  drawingOrder: string[];
  drawingTurn: number;
}

export interface StoredSession {
  playerId: string;
  roomCode: string;
  name: string;
  resumeToken: string;
  sessionId?: string;
}
