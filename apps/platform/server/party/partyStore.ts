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

export function partyToView(party: PartySession) {
  return {
    partyId: party.partyId,
    inviteCode: party.inviteCode,
    hostPlayerId: party.hostPlayerId,
    members: Array.from(party.members.values()).map(({ resumeToken: _rt, ...pub }) => pub),
    selectedGameId: party.selectedGameId,
    activeMatch: party.activeMatch,
    status: party.status,
  };
}
