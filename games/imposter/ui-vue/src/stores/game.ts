import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { RoomView, Phase, PlayerView, StoredSession } from '@shared/types';

const SESSION_KEY = 'imposter.session';

export const useGameStore = defineStore('game', () => {
  // ─── Session ───────────────────────────────────────────────────────────────
  const playerId = ref<string | null>(null);
  const roomCode = ref<string | null>(null);
  const resumeToken = ref<string | null>(null);
  const playerName = ref<string | null>(null);

  // ─── Room state (from server) ──────────────────────────────────────────────
  const phase = ref<Phase | null>(null);
  const room = ref<RoomView | null>(null);

  // ─── Computed ──────────────────────────────────────────────────────────────

  const me = computed<PlayerView | null>(
    () => room.value?.players.find((p) => p.id === playerId.value) ?? null
  );

  const isHost = computed(() => me.value?.isHost ?? false);

  const isInfiltrator = computed(() => {
    if (!room.value?.infiltratorIds || !playerId.value) return false;
    return room.value.infiltratorIds.includes(playerId.value);
  });

  const myWord = computed(() => room.value?.yourWord ?? null);

  const hasSubmittedDescription = computed(() => {
    if (!room.value || !playerId.value) return false;
    return room.value.submittedDescriptionIds.includes(playerId.value);
  });

  const hasVoted = computed(() => {
    if (!room.value || !playerId.value) return false;
    return room.value.submittedVoteIds.includes(playerId.value);
  });

  const connectedPlayers = computed(
    () => room.value?.players.filter((p: PlayerView) => p.connected) ?? []
  );

  const isCaughtInfiltrator = computed(() => {
    if (!room.value || !playerId.value) return false;
    return room.value.revealedInfiltrators.includes(playerId.value);
  });

  // ─── Actions ──────────────────────────────────────────────────────────────

  function applyRoomState(state: RoomView) {
    room.value = state;
    phase.value = state.phase;
  }

  function setSession(data: {
    playerId: string;
    roomCode: string;
    resumeToken: string;
    name: string;
  }) {
    playerId.value = data.playerId;
    roomCode.value = data.roomCode;
    resumeToken.value = data.resumeToken;
    playerName.value = data.name;
  }

  function saveSession() {
    if (!playerId.value || !roomCode.value || !resumeToken.value || !playerName.value) return;
    const session: StoredSession = {
      playerId: playerId.value,
      roomCode: roomCode.value,
      resumeToken: resumeToken.value,
      name: playerName.value,
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }

  function loadSession(): StoredSession | null {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as StoredSession;
    } catch {
      return null;
    }
  }

  function clearSession() {
    localStorage.removeItem(SESSION_KEY);
    playerId.value = null;
    roomCode.value = null;
    resumeToken.value = null;
    playerName.value = null;
    phase.value = null;
    room.value = null;
  }

  function reset() {
    playerId.value = null;
    roomCode.value = null;
    resumeToken.value = null;
    playerName.value = null;
    phase.value = null;
    room.value = null;
  }

  return {
    playerId,
    roomCode,
    resumeToken,
    playerName,
    phase,
    room,
    me,
    isHost,
    isInfiltrator,
    myWord,
    hasSubmittedDescription,
    hasVoted,
    connectedPlayers,
    isCaughtInfiltrator,
    applyRoomState,
    setSession,
    saveSession,
    loadSession,
    clearSession,
    reset,
  };
});
