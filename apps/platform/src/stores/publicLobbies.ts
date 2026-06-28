import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

/**
 * Public, joinable lobby wire view. Mirrors the server `JoinablePartyView`.
 * Duplicated client-side because no shared package exists between server and client.
 *
 * Only host-opted-in lobbies expose this data. No host/member identity, socket
 * ids, party ids, or tokens are included.
 */
export interface JoinablePartyView {
  inviteCode: string;
  gameId: string | null;
  gameName: string | null;
  minPlayers: number | null;
  maxPlayers: number | null;
  connectedPlayers: number;
  status: 'lobby';
  listedAt: number;
}

export type PublicLobbiesLoadState = 'idle' | 'loading' | 'ready' | 'error';

export const usePublicLobbiesStore = defineStore('platform-public-lobbies', () => {
  const parties = ref<JoinablePartyView[]>([]);
  const state = ref<PublicLobbiesLoadState>('idle');
  const error = ref<string | null>(null);
  const lastUpdated = ref<number | null>(null);

  const isEmpty = computed(() => state.value === 'ready' && parties.value.length === 0);

  /** Apply a fresh snapshot from the server, sorted newest-first as a defensive guarantee. */
  function applyUpdate(next: JoinablePartyView[]): void {
    parties.value = [...next].sort((a, b) => b.listedAt - a.listedAt);
    state.value = 'ready';
    error.value = null;
    lastUpdated.value = Date.now();
  }

  function setLoading(): void {
    state.value = 'loading';
  }

  /** Record an error without clearing existing rooms (non-destructive). */
  function setError(message: string): void {
    state.value = 'error';
    error.value = message;
  }

  function reset(): void {
    parties.value = [];
    state.value = 'idle';
    error.value = null;
    lastUpdated.value = null;
  }

  return {
    parties,
    state,
    error,
    lastUpdated,
    isEmpty,
    applyUpdate,
    setLoading,
    setError,
    reset,
  };
});
