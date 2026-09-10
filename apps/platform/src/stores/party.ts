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
  }

  function saveSession(inviteCode: string): void {
    if (!playerId.value || !playerName.value || !resumeToken.value) return;
    const session: PersistedSession = {
      inviteCode,
      playerId: playerId.value,
      playerName: playerName.value,
      resumeToken: resumeToken.value,
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }

  /**
   * Shape-check a persisted session before trusting it.
   *
   * `localStorage` is user-writable and survives across app versions, so a
   * corrupted or hand-edited entry would otherwise be cast straight to
   * `PersistedSession` and its undefined fields sent to the server. The
   * server rejects them, but the client would sit in a confusing half-resumed
   * state rather than simply starting over.
   */
  function isPersistedSession(value: unknown): value is PersistedSession {
    if (typeof value !== 'object' || value === null) return false;
    const candidate = value as Record<string, unknown>;
    return (
      typeof candidate.inviteCode === 'string' &&
      candidate.inviteCode.length > 0 &&
      typeof candidate.playerId === 'string' &&
      candidate.playerId.length > 0 &&
      typeof candidate.playerName === 'string' &&
      candidate.playerName.length > 0 &&
      typeof candidate.resumeToken === 'string' &&
      candidate.resumeToken.length > 0
    );
  }

  function loadSession(): PersistedSession | null {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const parsed: unknown = JSON.parse(raw);
      if (!isPersistedSession(parsed)) {
        localStorage.removeItem(SESSION_KEY);
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }

  function clearSession(): void {
    party.value = null;
    playerId.value = null;
    playerName.value = null;
    resumeToken.value = null;
    localStorage.removeItem(SESSION_KEY);
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
  };
});
