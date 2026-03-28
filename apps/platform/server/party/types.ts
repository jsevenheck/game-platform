export type PartyStatus = 'lobby' | 'in-match' | 'returning';

export interface PartyMember {
  playerId: string;
  name: string;
  connected: boolean;
  socketId: string | null;
  /** Server-issued secret; never broadcast. Required to re-bind after disconnect. */
  resumeToken: string;
}

export interface PartyMatch {
  gameId: string;
  matchKey: string;
  namespace: string;
  startedAt: number;
}

export interface PartySession {
  partyId: string;
  inviteCode: string;
  hostPlayerId: string;
  members: Map<string, PartyMember>;
  selectedGameId: string | null;
  activeMatch: PartyMatch | null;
  status: PartyStatus;
  /** socketIds that have acknowledged returning to lobby */
  returnAcks: Set<string>;
  /** matchKey of match currently being cleaned up after replay */
  pendingCleanupMatchKey: string | null;
}
