import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type {
  RoomView,
  Phase,
  PlayerView,
  TeamColor,
  CardView,
  StoredSession,
} from '@shared/types';
import { getMinimumPlayersForTeamCount } from '@shared/constants';

const SESSION_KEY = 'secret-signals.session';

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

  const currentPlayer = computed<PlayerView | null>(() => {
    if (!room.value || !playerId.value) return null;
    return room.value.players.find((p) => p.id === playerId.value) ?? null;
  });

  const isHost = computed(() => currentPlayer.value?.isHost ?? false);

  const isDirector = computed(() => currentPlayer.value?.role === 'director');

  const isAgent = computed(() => currentPlayer.value?.role === 'agent');

  const myTeam = computed<TeamColor | null>(() => currentPlayer.value?.team ?? null);

  const isMyTurn = computed(() => {
    if (!room.value || !myTeam.value) return false;
    return room.value.currentTurnTeam === myTeam.value;
  });

  const canGiveSignal = computed(
    () => isMyTurn.value && isDirector.value && room.value?.turnPhase === 'giving-signal'
  );

  const canGuess = computed(
    () => isMyTurn.value && isAgent.value && room.value?.turnPhase === 'guessing'
  );

  const canEndTurn = computed(
    () => isMyTurn.value && isAgent.value && room.value?.turnPhase === 'guessing'
  );

  const board = computed<CardView[]>(() => room.value?.board ?? []);

  const currentSignal = computed(() => room.value?.currentSignal ?? null);

  const minimumPlayers = computed(() => {
    const teamCount = room.value?.teamCount ?? 2;
    return getMinimumPlayersForTeamCount(teamCount);
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
    reset();
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
    currentPlayer,
    isHost,
    isDirector,
    isAgent,
    myTeam,
    isMyTurn,
    canGiveSignal,
    canGuess,
    canEndTurn,
    board,
    currentSignal,
    minimumPlayers,
    applyRoomState,
    setSession,
    saveSession,
    loadSession,
    clearSession,
    reset,
  };
});
