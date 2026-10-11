import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export interface PartyMemberView {
  playerId: string;
  name: string;
  connected: boolean;
}

export interface PartyMatchView {
  gameId: string;
  matchKey: string;
  namespace: string;
  startedAt: number;
}

export type PartyStatus = 'lobby' | 'launching' | 'in-match' | 'returning';

export interface PartyView {
  partyId: string;
  inviteCode: string;
  hostPlayerId: string;
  members: PartyMemberView[];
  selectedGameId: string | null;
  activeMatch: PartyMatchView | null;
  status: PartyStatus;
  isPublic: boolean;
  publicListedAt: number | null;
}

const SESSION_KEY = 'platform.party.session';

/**
 * `resumeParty` errors after which the stored session can never succeed again
 * (the party is gone — e.g. the server restarted — or the member was removed).
 * Anything else (rate limit, internal error) is transient and keeps the session.
 */
const TERMINAL_RESUME_ERRORS = new Set([
  'Party not found',
  'Player not in party',
  'Invalid resume token',
]);

export function isTerminalResumeError(error: string): boolean {
  return TERMINAL_RESUME_ERRORS.has(error);
}

interface PersistedSession {
  inviteCode: string;
  playerId: string;
  playerName: string;
  resumeToken: string;
}

export const usePartyStore = defineStore('platform-party', () => {
  const party = ref<PartyView | null>(null);
  const playerId = ref<string | null>(null);
  const playerName = ref<string | null>(null);
  const resumeToken = ref<string | null>(null);
  /** Shown once on the home screen after a stored session turned out to be gone. */
  const sessionEndedNotice = ref(false);
  const persistenceUnavailable = ref(false);
  let memorySession: PersistedSession | null = null;
  let sessionRead = false;

  const isHost = computed(() => {
    if (!party.value || !playerId.value) return false;
    return party.value.hostPlayerId === playerId.value;
  });

  const self = computed(() => {
    if (!party.value || !playerId.value) return null;
    return party.value.members.find((m) => m.playerId === playerId.value) ?? null;
  });

  const connectedMembers = computed(() => {
    return party.value?.members.filter((m) => m.connected) ?? [];
  });

  function applyPartyUpdate(view: PartyView): void {
    party.value = view;
  }

  function setSession(data: {
    playerId: string;
    playerName: string;
    inviteCode: string;
    resumeToken?: string;
  }): void {
    playerId.value = data.playerId;
    playerName.value = data.playerName;
    if (data.resumeToken) resumeToken.value = data.resumeToken;
    if (resumeToken.value) {
      memorySession = { ...data, resumeToken: resumeToken.value };
      sessionRead = true;
    }
  }

  function saveSession(inviteCode: string): void {
    if (!playerId.value || !playerName.value || !resumeToken.value) return;
    const session: PersistedSession = {
      inviteCode,
      playerId: playerId.value,
      playerName: playerName.value,
      resumeToken: resumeToken.value,
    };
    memorySession = session;
    sessionRead = true;
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      persistenceUnavailable.value = false;
    } catch {
      // Keep the live session usable even if browser persistence is denied.
      persistenceUnavailable.value = true;
    }
  }

  function loadSession(): PersistedSession | null {
    if (sessionRead) return memorySession;
    sessionRead = true;
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      const value: unknown = raw ? JSON.parse(raw) : null;
      if (!value || typeof value !== 'object') return null;
      const session = value as Record<string, unknown>;
      if (
        typeof session.inviteCode !== 'string' ||
        !/^[A-Z0-9]{6}$/.test(session.inviteCode) ||
        typeof session.playerId !== 'string' ||
        !session.playerId.trim() ||
        session.playerId.length > 64 ||
        typeof session.playerName !== 'string' ||
        !session.playerName.trim() ||
        session.playerName.length > 20 ||
        typeof session.resumeToken !== 'string' ||
        !session.resumeToken.trim() ||
        session.resumeToken.length > 256
      )
        return null;
      memorySession = {
        inviteCode: session.inviteCode,
        playerId: session.playerId,
        playerName: session.playerName,
        resumeToken: session.resumeToken,
      };
      return memorySession;
    } catch {
      return null;
    }
  }

  function clearSession(): void {
    party.value = null;
    playerId.value = null;
    playerName.value = null;
    resumeToken.value = null;
    memorySession = null;
    // Do not resurrect a stale persisted session if removeItem fails.
    sessionRead = true;
    persistenceUnavailable.value = false;
    try {
      localStorage.removeItem(SESSION_KEY);
    } catch {
      /* In-memory logout still succeeds. */
    }
  }

  /** Drop a session that can no longer be resumed and tell the player why. */
  function endSession(): void {
    clearSession();
    sessionEndedNotice.value = true;
  }

  return {
    party,
    playerId,
    playerName,
    resumeToken,
    isHost,
    self,
    connectedMembers,
    applyPartyUpdate,
    setSession,
    saveSession,
    loadSession,
    clearSession,
    endSession,
    sessionEndedNotice,
    persistenceUnavailable,
  };
});
