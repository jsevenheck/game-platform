export type PartyStatus = 'lobby' | 'launching' | 'in-match' | 'returning';

export interface PartyMember {
  playerId: string;
  name: string;
  connected: boolean;
  socketId: string | null;
  /** Server-issued secret; never broadcast. Required to re-bind after disconnect. */
  resumeToken: string;
}

/** UI languages the platform ships; also the language of a match's content (questions, words). */
export type MatchLocale = 'en' | 'de';

export function normalizeMatchLocale(value: unknown): MatchLocale {
  return value === 'de' ? 'de' : 'en';
}

export interface PartyMatch {
  gameId: string;
  matchKey: string;
  namespace: string;
  startedAt: number;
  /** Content language, taken from the host's UI language when the match starts. */
  locale?: MatchLocale;
}

export interface PartySession {
  partyId: string;
  inviteCode: string;
  hostPlayerId: string;
  /**
   * Member who owns the party (its creator, or whoever inherited ownership
   * when the owner left). Host moves to another member while the owner is
   * disconnected and returns to the owner when they resume.
   */
  ownerPlayerId: string;
  members: Map<string, PartyMember>;
  selectedGameId: string | null;
  activeMatch: PartyMatch | null;
  status: PartyStatus;
  /** socketIds that have acknowledged returning to lobby */
  returnAcks: Set<string>;
  /** matchKey of match currently being cleaned up after replay */
  pendingCleanupMatchKey: string | null;
  /** Host opt-in to list this lobby publicly. Defaults false. */
  isPublic: boolean;
  /** Epoch ms when the party most recently became public; null when not public. */
  publicListedAt: number | null;
}
