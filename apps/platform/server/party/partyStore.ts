import { customAlphabet, nanoid } from 'nanoid';
import type { PartyMatch, PartySession, PartyMember } from './types';

const PARTY_IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const MATCH_TIMEOUT_MS = 2 * 60 * 60 * 1000; // 2 hours

/**
 * Hard ceiling on party membership, used when no game is selected yet (the
 * per-game `maxPlayers` is the tighter bound once one is). Without a cap,
 * `joinParty` grows `members` without limit and a party can be pushed past
 * the selected game's `maxPlayers` — a state `launchGame` rejects, so the
 * host can never start. Public lobbies broadcast their invite code by
 * design, which makes that trivially reachable by anyone.
 */
export const PARTY_MAX_MEMBERS = 20;

const parties = new Map<string, PartySession>();
const inviteCodeToParty = new Map<string, string>();
const socketToParty = new Map<string, string>();
/**
 * matchKey → partyId index for {@link getPartyByActiveMatch}. Every game's
 * per-event authorization resolves the owning party by matchKey, so this
 * lookup sits on the hottest path in the system; without an index it was a
 * linear scan of every party on the server, making per-event cost O(total
 * parties) rather than O(1). Maintained by {@link setActiveMatch} /
 * {@link clearActiveMatch} — never write `party.activeMatch` directly.
 */
const matchKeyToParty = new Map<string, string>();
const partyCleanupTimers = new Map<string, ReturnType<typeof setTimeout>>();
const matchTimeoutTimers = new Map<string, ReturnType<typeof setTimeout>>();

/**
 * Invite codes are the only gate on joining a non-public party, so they are
 * drawn from a CSPRNG (nanoid) rather than `Math.random()`, whose xorshift128+
 * state can be recovered from observed outputs — which would let an attacker
 * who creates a few parties predict codes issued to other users.
 * Alphabet excludes I/O/0/1 to stay unambiguous when read aloud or typed.
 */
const INVITE_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const INVITE_CODE_LENGTH = 6;
const generateInviteCodeCandidate = customAlphabet(INVITE_CODE_ALPHABET, INVITE_CODE_LENGTH);

function generateInviteCode(): string {
  let code: string;
  do {
    code = generateInviteCodeCandidate();
  } while (inviteCodeToParty.has(code));
  return code;
}

export function createParty(
  hostPlayerId: string,
  hostName: string,
  socketId: string
): { party: PartySession; hostResumeToken: string } {
  const partyId = nanoid(12);
  const inviteCode = generateInviteCode();
  const hostResumeToken = nanoid(24);

  const host: PartyMember = {
    playerId: hostPlayerId,
    name: hostName,
    connected: true,
    socketId,
    resumeToken: hostResumeToken,
  };

  const party: PartySession = {
    partyId,
    inviteCode,
    hostPlayerId,
    members: new Map([[hostPlayerId, host]]),
    selectedGameId: null,
    activeMatch: null,
    status: 'lobby',
    returnAcks: new Set(),
    pendingCleanupMatchKey: null,
    isPublic: false,
    publicListedAt: null,
  };

  parties.set(partyId, party);
  inviteCodeToParty.set(inviteCode, partyId);
  socketToParty.set(socketId, partyId);

  return { party, hostResumeToken };
}

export function getParty(partyId: string): PartySession | undefined {
  return parties.get(partyId);
}

export function getPartyByInviteCode(inviteCode: string): PartySession | undefined {
  const partyId = inviteCodeToParty.get(inviteCode.toUpperCase());
  return partyId ? parties.get(partyId) : undefined;
}

export function getPartyBySocket(socketId: string): PartySession | undefined {
  const partyId = socketToParty.get(socketId);
  return partyId ? parties.get(partyId) : undefined;
}

/**
 * Bind `match` to `party` as its active match, keeping the matchKey index in
 * sync. Use this instead of assigning `party.activeMatch` directly.
 */
export function setActiveMatch(party: PartySession, match: PartyMatch): void {
  if (party.activeMatch) matchKeyToParty.delete(party.activeMatch.matchKey);
  party.activeMatch = match;
  matchKeyToParty.set(match.matchKey, party.partyId);
}

/**
 * Clear a party's active match, keeping the matchKey index in sync. Returns
 * the match that was cleared so callers can hand its `matchKey` to the game
 * module's `cleanupMatch`.
 */
export function clearActiveMatch(party: PartySession): PartyMatch | null {
  const previous = party.activeMatch;
  if (previous) matchKeyToParty.delete(previous.matchKey);
  party.activeMatch = null;
  return previous;
}

function matchesRequest(
  party: PartySession | undefined,
  matchKey: string,
  gameId?: string
): party is PartySession {
  return (
    !!party &&
    party.status === 'in-match' &&
    party.activeMatch?.matchKey === matchKey &&
    (!gameId || party.activeMatch.gameId === gameId)
  );
}

/**
 * Resolve the party that owns an active match.
 *
 * The `matchKeyToParty` index makes this O(1) on the hot path (every game's
 * per-event authorization calls it). The fallback scan below exists so that
 * correctness never depends on every writer remembering to go through
 * {@link setActiveMatch}: an index miss re-derives the answer and repairs the
 * index, so a party whose `activeMatch` was assigned directly still
 * authorizes correctly — it just pays for one scan first. Authorization
 * failing open-ended (returning `undefined` and locking players out of a
 * legitimate match) would be a far worse failure than a slow lookup.
 */
export function getPartyByActiveMatch(matchKey: string, gameId?: string): PartySession | undefined {
  const normalizedMatchKey = matchKey.trim();
  if (!normalizedMatchKey) return undefined;

  const indexedPartyId = matchKeyToParty.get(normalizedMatchKey);
  if (indexedPartyId) {
    const indexed = parties.get(indexedPartyId);
    if (matchesRequest(indexed, normalizedMatchKey, gameId)) return indexed;
    // Stale or wrong-game entry — drop it and fall through to the scan, which
    // re-adds it if some party does legitimately own this match.
    matchKeyToParty.delete(normalizedMatchKey);
  }

  for (const party of parties.values()) {
    if (matchesRequest(party, normalizedMatchKey, gameId)) {
      matchKeyToParty.set(normalizedMatchKey, party.partyId);
      return party;
    }
  }

  return undefined;
}

export function getAllParties(): PartySession[] {
  return Array.from(parties.values());
}

export function registerSocket(socketId: string, partyId: string): void {
  socketToParty.set(socketId, partyId);
}

export function unregisterSocket(socketId: string): void {
  socketToParty.delete(socketId);
}

/**
 * Delete a party and every index entry pointing at it.
 *
 * `onActiveMatch`, when given, runs synchronously right before deletion if
 * the party still has a live match — callers use it to end that match via
 * the game module's `cleanupMatch`. Passing it is how a caller stays correct
 * for a party that is torn down mid-match: `deleteParty` also cancels the
 * 2-hour match-timeout timer that would otherwise have been the backstop, so
 * a deletion that skips this leaves the game module's room with no remaining
 * platform-side path to reclaim it. partyStore intentionally has no
 * dependency on the game registry, so the cleanup is passed in by the caller
 * rather than looked up here.
 */
export function deleteParty(partyId: string, onActiveMatch?: (party: PartySession) => void): void {
  const party = parties.get(partyId);
  if (!party) return;

  if (party.activeMatch && onActiveMatch) {
    onActiveMatch(party);
  }

  clearPartyCleanup(partyId);
  clearMatchTimeout(partyId);
  inviteCodeToParty.delete(party.inviteCode);
  if (party.activeMatch) {
    matchKeyToParty.delete(party.activeMatch.matchKey);
  }
  for (const member of party.members.values()) {
    if (member.socketId) {
      socketToParty.delete(member.socketId);
    }
  }
  parties.delete(partyId);
}

/**
 * Schedule idle-party deletion after {@link PARTY_IDLE_TIMEOUT_MS} of
 * nobody being connected.
 *
 * `onExpire`, when given, runs synchronously right before the party is
 * deleted — the caller uses it to end the party's active match (via the
 * game module's `cleanupMatch`) exactly as every other path that ends a
 * match already does (`triggerMatchTimeout`, `returnToLobby`, `replayGame`,
 * admin kick/cleanup). Without it, a party that goes idle while
 * `activeMatch` is still set would be deleted here with no path left to
 * ever call `cleanupMatch` for that match: `deleteParty` also cancels the
 * 2-hour match-timeout timer that would otherwise have been the backstop.
 * partyStore intentionally has no dependency on the game registry, so this
 * is passed in by the caller (`partyHandlers.ts`) rather than looked up
 * here.
 */
export function schedulePartyCleanup(
  partyId: string,
  onExpire?: (party: PartySession) => void
): void {
  clearPartyCleanup(partyId);
  partyCleanupTimers.set(
    partyId,
    setTimeout(() => {
      partyCleanupTimers.delete(partyId);
      const party = parties.get(partyId);
      if (!party) return;
      const anyConnected = Array.from(party.members.values()).some((m) => m.connected);
      if (!anyConnected) {
        deleteParty(partyId, onExpire);
      }
    }, PARTY_IDLE_TIMEOUT_MS)
  );
}

export function clearPartyCleanup(partyId: string): void {
  const timer = partyCleanupTimers.get(partyId);
  if (timer) {
    clearTimeout(timer);
    partyCleanupTimers.delete(partyId);
  }
}

export function scheduleMatchTimeout(partyId: string, onTimeout: () => void): void {
  clearMatchTimeout(partyId);
  matchTimeoutTimers.set(
    partyId,
    setTimeout(() => {
      matchTimeoutTimers.delete(partyId);
      onTimeout();
    }, MATCH_TIMEOUT_MS)
  );
}

export function clearMatchTimeout(partyId: string): void {
  const timer = matchTimeoutTimers.get(partyId);
  if (timer) {
    clearTimeout(timer);
    matchTimeoutTimers.delete(partyId);
  }
}

export interface PartyStoreSnapshot {
  totalParties: number;
  connectedMembers: number;
  inMatchParties: number;
}

export function getPartySnapshot(): PartyStoreSnapshot {
  let connectedMembers = 0;
  let inMatchParties = 0;

  for (const party of parties.values()) {
    if (party.status === 'in-match') {
      inMatchParties += 1;
    }

    for (const member of party.members.values()) {
      if (member.connected) {
        connectedMembers += 1;
      }
    }
  }

  return {
    totalParties: parties.size,
    connectedMembers,
    inMatchParties,
  };
}
export function partyToView(party: PartySession) {
  return {
    partyId: party.partyId,
    inviteCode: party.inviteCode,
    hostPlayerId: party.hostPlayerId,
    // Strip resumeToken (secret) and socketId (an internal server detail no
    // client ever reads — an unnecessary exposure of another player's
    // implementation-level identifier) from the broadcast view.
    members: Array.from(party.members.values()).map(
      ({ resumeToken: _rt, socketId: _sid, ...pub }) => pub
    ),
    selectedGameId: party.selectedGameId,
    activeMatch: party.activeMatch,
    status: party.status,
    isPublic: party.isPublic,
    publicListedAt: party.publicListedAt,
  };
}

/**
 * Toggle a party's public-listing opt-in. No-op when the value is unchanged.
 * Updates `publicListedAt` to mark when the party most recently became public.
 */
export function setPartyPublic(party: PartySession, isPublic: boolean): void {
  if (party.isPublic === isPublic) return;
  party.isPublic = isPublic;
  party.publicListedAt = isPublic ? Date.now() : null;
}

/** Number of currently connected members in a party. */
export function connectedMemberCount(party: PartySession): number {
  return Array.from(party.members.values()).filter((m) => m.connected).length;
}

/**
 * Whether a party should appear in the public, joinable lobby snapshot.
 * Requires host opt-in, lobby status, and at least one connected member.
 */
export function isJoinablePublicParty(party: PartySession): boolean {
  return party.isPublic && party.status === 'lobby' && connectedMemberCount(party) > 0;
}

export interface ActivePartyMatch {
  gameId: string;
  matchKey: string;
}

export function getActivePartyMatches(): ActivePartyMatch[] {
  const matches: ActivePartyMatch[] = [];

  for (const party of parties.values()) {
    if (party.status === 'in-match' && party.activeMatch) {
      matches.push({
        gameId: party.activeMatch.gameId,
        matchKey: party.activeMatch.matchKey,
      });
    }
  }

  return matches;
}

export interface ClearAllPartiesResult {
  partiesRemoved: number;
  membersRemoved: number;
}

export function clearAllParties(): ClearAllPartiesResult {
  let membersRemoved = 0;
  for (const party of parties.values()) {
    membersRemoved += party.members.size;
  }

  for (const timer of partyCleanupTimers.values()) clearTimeout(timer);
  for (const timer of matchTimeoutTimers.values()) clearTimeout(timer);

  const partiesRemoved = parties.size;
  parties.clear();
  inviteCodeToParty.clear();
  socketToParty.clear();
  matchKeyToParty.clear();
  partyCleanupTimers.clear();
  matchTimeoutTimers.clear();

  return { partiesRemoved, membersRemoved };
}
