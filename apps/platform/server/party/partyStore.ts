import { nanoid } from 'nanoid';
import type { PartySession, PartyMember } from './types';

const PARTY_IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const MATCH_TIMEOUT_MS = 2 * 60 * 60 * 1000; // 2 hours

const parties = new Map<string, PartySession>();
const inviteCodeToParty = new Map<string, string>();
const socketToParty = new Map<string, string>();
const partyCleanupTimers = new Map<string, ReturnType<typeof setTimeout>>();
const matchTimeoutTimers = new Map<string, ReturnType<typeof setTimeout>>();

function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code: string;
  do {
    code = '';
    for (let i = 0; i < 6; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
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

export function getPartyByActiveMatch(matchKey: string, gameId?: string): PartySession | undefined {
  const normalizedMatchKey = matchKey.trim();
  if (!normalizedMatchKey) return undefined;

  for (const party of parties.values()) {
    if (
      party.status === 'in-match' &&
      party.activeMatch?.matchKey === normalizedMatchKey &&
      (!gameId || party.activeMatch.gameId === gameId)
    ) {
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

export function deleteParty(partyId: string): void {
  const party = parties.get(partyId);
  if (!party) return;

  clearPartyCleanup(partyId);
  clearMatchTimeout(partyId);
  inviteCodeToParty.delete(party.inviteCode);
  for (const member of party.members.values()) {
    if (member.socketId) {
      socketToParty.delete(member.socketId);
    }
  }
  parties.delete(partyId);
}

export function schedulePartyCleanup(partyId: string): void {
  clearPartyCleanup(partyId);
  partyCleanupTimers.set(
    partyId,
    setTimeout(() => {
      partyCleanupTimers.delete(partyId);
      const party = parties.get(partyId);
      if (!party) return;
      const anyConnected = Array.from(party.members.values()).some((m) => m.connected);
      if (!anyConnected) {
        deleteParty(partyId);
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
    members: Array.from(party.members.values()).map(({ resumeToken: _rt, ...pub }) => pub),
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
  partyCleanupTimers.clear();
  matchTimeoutTimers.clear();

  return { partiesRemoved, membersRemoved };
}
