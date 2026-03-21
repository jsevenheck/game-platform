export type Phase = 'lobby' | 'playing' | 'ended';

export type TeamColor = 'red' | 'blue' | 'green' | 'orange' | 'purple' | 'teal' | 'pink' | 'gold';

export type CardType = TeamColor | 'neutral' | 'assassin';

export type PlayerRole = 'director' | 'agent';

export type TurnPhase = 'giving-signal' | 'guessing';

export type AssassinPenaltyMode = 'instant-loss' | 'elimination';

export interface Card {
  word: string;
  type: CardType;
  revealed: boolean;
  revealedBy: TeamColor | null;
}

export interface CardView {
  word: string;
  type: CardType | null;
  revealed: boolean;
  revealedBy: TeamColor | null;
}

export interface Signal {
  word: string;
  number: number;
  teamColor: TeamColor;
  guessesUsed: number;
}

export interface LogEntry {
  teamColor: TeamColor;
  signal: { word: string; number: number };
  revealedCards: Array<{ word: string; type: CardType }>;
  endReason:
    | 'correct-complete'
    | 'wrong-team'
    | 'neutral'
    | 'assassin'
    | 'voluntary'
    | 'max-guesses';
}

export interface TeamConfig {
  color: TeamColor;
  targetCount: number;
  revealedCount: number;
  eliminated: boolean;
}

export interface Player {
  id: string;
  name: string;
  resumeToken: string;
  score: number;
  connected: boolean;
  isHost: boolean;
  socketId: string | null;
  team: TeamColor | null;
  role: PlayerRole | null;
}

export interface PlayerView {
  id: string;
  name: string;
  score: number;
  connected: boolean;
  isHost: boolean;
  team: TeamColor | null;
  role: PlayerRole | null;
}

export interface FocusMarker {
  cardIndex: number;
  playerId: string;
}

export interface Room {
  code: string;
  hostId: string | null;
  phase: Phase;
  players: Record<string, Player>;
  board: Card[];
  teams: TeamConfig[];
  currentTurnTeam: TeamColor | null;
  turnPhase: TurnPhase | null;
  currentSignal: Signal | null;
  turnOrder: TeamColor[];
  log: LogEntry[];
  winnerTeam: TeamColor | null;
  winningTeams: TeamColor[];
  teamCount: number;
  assassinPenaltyMode: AssassinPenaltyMode;
  focusedCards: FocusMarker[];
  nextStartingTeamIndex: number;
}

export interface RoomView {
  code: string;
  phase: Phase;
  players: PlayerView[];
  board: CardView[];
  teams: TeamConfig[];
  currentTurnTeam: TeamColor | null;
  turnPhase: TurnPhase | null;
  currentSignal: Signal | null;
  turnOrder: TeamColor[];
  log: LogEntry[];
  winnerTeam: TeamColor | null;
  winningTeams: TeamColor[];
  teamCount: number;
  assassinPenaltyMode: AssassinPenaltyMode;
  focusedCards: FocusMarker[];
}

export interface StoredSession {
  playerId: string;
  roomCode: string;
  name: string;
  resumeToken: string;
}
