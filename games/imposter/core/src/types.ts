export type Phase = 'lobby' | 'description' | 'discussion' | 'voting' | 'reveal' | 'ended';

export interface Player {
  id: string;
  name: string;
  resumeToken: string;
  score: number;
  connected: boolean;
  isHost: boolean;
  socketId: string | null;
}

export interface PlayerView {
  id: string;
  name: string;
  score: number;
  connected: boolean;
  isHost: boolean;
}

export interface RoundResult {
  secretWord: string;
  infiltratorIds: string[];
  votedOutIds: string[];
  infiltratorsCaught: boolean;
  infiltratorGuess: string | null;
  infiltratorGuessCorrect: boolean;
  winner: 'civilians' | 'infiltrators';
}

export interface Room {
  code: string;
  ownerId: string;
  hostId: string | null;
  phase: Phase;
  players: Record<string, Player>;

  infiltratorCount: number;
  discussionDurationMs: number;
  targetScore: number;

  secretWord: string | null;
  infiltratorIds: string[];
  descriptionOrder: string[];
  descriptions: Record<string, string>;
  currentDescriberId: string | null;
  votes: Record<string, string>;
  roundNumber: number;
  wordLibrary: string[];
  discussionEndsAt: number | null;

  revealedInfiltrators: string[];
  infiltratorGuess: string | null;
  waitingForGuess: boolean;

  lastRoundResult: RoundResult | null;
  roundHistory: RoundResult[];
}

export interface RoomView {
  code: string;
  phase: Phase;
  players: PlayerView[];

  infiltratorCount: number;
  discussionDurationMs: number;
  targetScore: number;

  yourWord: string | null;

  roundNumber: number;
  wordLibraryCount: number;

  submittedDescriptionIds: string[];
  descriptions: Record<string, string> | null;
  descriptionOrder: string[];
  currentDescriberId: string | null;

  discussionEndsAt: number | null;

  submittedVoteIds: string[];
  votes: Record<string, string> | null;

  revealedInfiltrators: string[];
  infiltratorIds: string[] | null;
  secretWord: string | null;
  waitingForGuess: boolean;
  infiltratorGuess: string | null;
  lastRoundResult: RoundResult | null;

  roundHistory: RoundResult[];
}

export interface StoredSession {
  playerId: string;
  roomCode: string;
  name: string;
  resumeToken: string;
}
