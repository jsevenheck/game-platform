export type PartyStatus = 'lobby' | 'launching' | 'in-match' | 'returning';

export interface PartyMember {
  playerId: string;
  name: string;
  connected: boolean;
  socketId: string | null;
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
