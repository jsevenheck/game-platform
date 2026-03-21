<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import type { AssassinPenaltyMode, PlayerRole, TeamColor } from '@shared/types';
import type { HubIntegrationProps } from './types/config';
import { useGameStore } from './stores/game';
import { useSocket } from './composables/useSocket';
import Landing from './components/Landing.vue';
import Lobby from './components/Lobby.vue';
import GamePlay from './components/GamePlay.vue';
import GameOver from './components/GameOver.vue';

const props = withDefaults(defineProps<HubIntegrationProps>(), {
  playerId: undefined,
  playerName: undefined,
  sessionId: undefined,
  joinToken: undefined,
  wsNamespace: undefined,
  apiBaseUrl: undefined,
  isHost: undefined,
});

const emit = defineEmits<{ 'phase-change': [phase: string] }>();

const store = useGameStore();
const { socket } = useSocket({
  apiBaseUrl: props.apiBaseUrl,
  sessionId: props.sessionId,
  playerId: props.playerId,
  wsNamespace: props.wsNamespace,
});

const isEmbedded = !!props.wsNamespace;
const embeddedError = ref('');
const landingError = ref('');
const isRestoringSession = ref(false);
const autoJoinInFlight = ref(false);
let autoJoinRetryTimer: number | undefined;

function handleRoomState(state: Parameters<typeof store.applyRoomState>[0]) {
  store.applyRoomState(state);
  isRestoringSession.value = false;
  autoJoinInFlight.value = false;
  embeddedError.value = '';
  landingError.value = '';
  if (state.phase) emit('phase-change', state.phase);
}

socket.on('roomState', handleRoomState);

function emitAutoJoinRoom() {
  if (!props.sessionId || !socket.connected || store.room || autoJoinInFlight.value) return;

  embeddedError.value = '';
  autoJoinInFlight.value = true;
  socket.emit(
    'autoJoinRoom',
    {
      sessionId: props.sessionId,
      playerId: props.playerId || '',
      name: props.playerName || props.playerId || 'Player',
      isHost: props.isHost,
    },
    (res) => {
      autoJoinInFlight.value = false;
      if (!res.ok) {
        embeddedError.value = res.error;
        return;
      }
      store.setSession({
        playerId: res.playerId,
        roomCode: res.roomCode,
        resumeToken: res.resumeToken,
        name: props.playerName || props.playerId || 'Player',
      });
    }
  );
}

function handleCreate(name: string) {
  landingError.value = '';
  socket.emit('createRoom', { name }, (res) => {
    if (!res.ok) {
      landingError.value = res.error;
      return;
    }
    store.setSession({
      playerId: res.playerId,
      roomCode: res.roomCode,
      resumeToken: res.resumeToken,
      name,
    });
    store.saveSession();
  });
}

function handleJoin(name: string, code: string) {
  landingError.value = '';
  socket.emit('joinRoom', { name, code }, (res) => {
    if (!res.ok) {
      landingError.value = res.error;
      return;
    }
    store.setSession({
      playerId: res.playerId,
      roomCode: code,
      resumeToken: res.resumeToken,
      name,
    });
    store.saveSession();
  });
}

function handleLeave() {
  if (!store.roomCode || !store.playerId) {
    store.clearSession();
    return;
  }
  socket.emit('leaveRoom', { roomCode: store.roomCode, playerId: store.playerId }, (res) => {
    if (!res.ok) {
      landingError.value = res.error;
      return;
    }
    store.clearSession();
  });
}

function handleStartGame() {
  if (!store.roomCode || !store.playerId) return;
  socket.emit('startGame', { roomCode: store.roomCode, playerId: store.playerId }, () => {});
}

function handleAssignTeam(team: TeamColor) {
  if (!store.roomCode || !store.playerId) return;
  socket.emit('assignTeam', { roomCode: store.roomCode, playerId: store.playerId, team }, () => {});
}

function handleAssignRole(role: PlayerRole) {
  if (!store.roomCode || !store.playerId) return;
  socket.emit('assignRole', { roomCode: store.roomCode, playerId: store.playerId, role }, () => {});
}

function handleSetTeamCount(count: number) {
  if (!store.roomCode || !store.playerId) return;
  socket.emit(
    'setTeamCount',
    { roomCode: store.roomCode, playerId: store.playerId, teamCount: count },
    () => {}
  );
}

function handleSetAssassinPenaltyMode(mode: AssassinPenaltyMode) {
  if (!store.roomCode || !store.playerId) return;
  socket.emit(
    'setAssassinPenaltyMode',
    { roomCode: store.roomCode, playerId: store.playerId, mode },
    () => {}
  );
}

function handleFocusCard(cardIndex: number | null) {
  if (!store.roomCode || !store.playerId) return;
  socket.emit(
    'focusCard',
    { roomCode: store.roomCode, playerId: store.playerId, cardIndex },
    () => {}
  );
}

function handleGiveSignal(word: string, number: number) {
  if (!store.roomCode || !store.playerId) return;
  socket.emit(
    'giveSignal',
    { roomCode: store.roomCode, playerId: store.playerId, word, number },
    () => {}
  );
}

function handleRevealCard(cardIndex: number) {
  if (!store.roomCode || !store.playerId) return;
  socket.emit(
    'revealCard',
    { roomCode: store.roomCode, playerId: store.playerId, cardIndex },
    () => {}
  );
}

function handleEndTurn() {
  if (!store.roomCode || !store.playerId) return;
  socket.emit('endTurn', { roomCode: store.roomCode, playerId: store.playerId }, () => {});
}

function handleSkipGuessRound() {
  if (!store.roomCode || !store.playerId) return;
  socket.emit('skipGuessRound', { roomCode: store.roomCode, playerId: store.playerId }, () => {});
}

function handleRestart() {
  if (!store.roomCode || !store.playerId) return;
  socket.emit('restartGame', { roomCode: store.roomCode, playerId: store.playerId }, () => {});
}

function resumeStoredSession() {
  const session = store.loadSession();
  if (!session) {
    isRestoringSession.value = false;
    return;
  }

  isRestoringSession.value = true;
  store.setSession({
    playerId: session.playerId,
    roomCode: session.roomCode,
    resumeToken: session.resumeToken,
    name: session.name,
  });

  socket.emit(
    'resumePlayer',
    {
      roomCode: session.roomCode,
      playerId: session.playerId,
      resumeToken: session.resumeToken,
    },
    (res) => {
      if (!res.ok) {
        store.clearSession();
        isRestoringSession.value = false;
        landingError.value = 'Previous session could not be restored.';
      }
    }
  );
}

function handleSocketConnect() {
  if (isEmbedded) {
    emitAutoJoinRoom();
    return;
  }
  if (!store.loadSession()) return;
  if (store.currentPlayer?.connected) return;
  resumeStoredSession();
}

onMounted(() => {
  socket.on('connect', handleSocketConnect);

  if (isEmbedded && props.sessionId) {
    if (socket.connected) {
      emitAutoJoinRoom();
    } else {
      socket.connect();
    }

    autoJoinRetryTimer = window.setTimeout(() => {
      if (!store.room) emitAutoJoinRoom();
    }, 3000);
    return;
  }

  // Standalone mode
  const session = store.loadSession();
  if (!session) {
    socket.connect();
    return;
  }

  if (socket.connected) {
    resumeStoredSession();
  } else {
    isRestoringSession.value = true;
    socket.connect();
  }
});

onBeforeUnmount(() => {
  if (autoJoinRetryTimer !== undefined) {
    clearTimeout(autoJoinRetryTimer);
  }
  socket.off('roomState', handleRoomState);
  socket.off('connect', handleSocketConnect);
});
</script>

<template>
  <div class="app">
    <header v-if="store.room && !isEmbedded" class="app-header">
      <span class="header-room">{{ store.roomCode }}</span>
      <button class="leave-button" type="button" @click="handleLeave">Leave</button>
    </header>

    <template v-if="!store.room && isEmbedded">
      <p class="session-status">{{ embeddedError || 'Connecting...' }}</p>
    </template>
    <template v-else-if="store.phase === null && isRestoringSession">
      <p class="session-status">Reconnecting to your room...</p>
    </template>
    <Landing
      v-else-if="store.phase === null"
      :server-error="landingError"
      @create="handleCreate"
      @join="handleJoin"
    />
    <Lobby
      v-else-if="store.phase === 'lobby'"
      @start-game="handleStartGame"
      @assign-team="handleAssignTeam"
      @assign-role="handleAssignRole"
      @set-team-count="handleSetTeamCount"
      @set-assassin-penalty-mode="handleSetAssassinPenaltyMode"
    />
    <GamePlay
      v-else-if="store.phase === 'playing'"
      @focus-card="handleFocusCard"
      @give-signal="handleGiveSignal"
      @reveal-card="handleRevealCard"
      @end-turn="handleEndTurn"
      @skip-guess-round="handleSkipGuessRound"
    />
    <GameOver v-else-if="store.phase === 'ended'" @restart="handleRestart" />
  </div>
</template>

<style>
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: system-ui, sans-serif;
  background: #09090b;
  color: #e4e4e7;
}

.app {
  min-height: 100dvh;
}

.app-header {
  position: sticky;
  top: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.85rem 1rem;
  background: rgba(9, 9, 11, 0.92);
  border-bottom: 1px solid #27272a;
  backdrop-filter: blur(12px);
}

.header-room {
  color: #8b5cf6;
  font-size: 0.85rem;
  font-weight: 800;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.leave-button {
  border: 1px solid #3f3f46;
  border-radius: 999px;
  background: transparent;
  color: #e4e4e7;
  padding: 0.45rem 0.95rem;
  font: inherit;
  cursor: pointer;
}

.leave-button:hover {
  border-color: #ef4444;
  color: #fecaca;
  background: rgba(239, 68, 68, 0.12);
}

.session-status {
  padding: 2rem 1rem;
  text-align: center;
  color: #a1a1aa;
}
</style>
