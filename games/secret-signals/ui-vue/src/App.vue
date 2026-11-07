<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { localizeError } from '@platform/i18n/serverError';
import './i18n';
import type { AssassinPenaltyMode, PlayerRole, TeamColor } from '@shared/types';
import type { HubIntegrationProps } from './types/config';
import { useGameStore } from './stores/game';
import { useSocket } from './composables/useSocket';
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

const { t } = useI18n();
const store = useGameStore();
const { socket } = useSocket({
  apiBaseUrl: props.apiBaseUrl,
  sessionId: props.sessionId,
  playerId: props.playerId,
  joinToken: props.joinToken,
  wsNamespace: props.wsNamespace,
});

const embeddedError = ref('');
const actionError = ref('');
const actionPending = ref(false);
let actionTimer: ReturnType<typeof setTimeout> | undefined;
let actionGeneration = 0;
function beginAction() {
  if (actionPending.value) return false;
  actionPending.value = true;
  actionError.value = '';
  actionTimer = setTimeout(() => {
    actionPending.value = false;
    actionError.value = t('secret-signals.actionTimeout');
    actionGeneration += 1;
  }, 8000);
  return true;
}
function actionCallback() {
  const generation = actionGeneration;
  return (response: { ok: boolean; error?: string }) => {
    if (generation !== actionGeneration) return;
    if (actionTimer) clearTimeout(actionTimer);
    actionPending.value = false;
    actionError.value = response.ok ? '' : (response.error ?? t('secret-signals.actionTimeout'));
    actionGeneration += 1;
  };
}
const autoJoinInFlight = ref(false);
let autoJoinRetryTimer: number | undefined;
let autoJoinRetryCount = 0;
const MAX_AUTO_JOIN_RETRIES = 3;

function handleRoomState(state: Parameters<typeof store.applyRoomState>[0]) {
  store.applyRoomState(state);
  autoJoinInFlight.value = false;
  autoJoinRetryCount = 0;
  embeddedError.value = '';
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
      resumeToken: store.resumeToken || undefined,
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
      store.saveSession();
    }
  );
}

function handleStartGame() {
  if (!store.roomCode || !store.playerId || !beginAction()) return;
  socket.emit(
    'startGame',
    { roomCode: store.roomCode, playerId: store.playerId },
    actionCallback()
  );
}

function handleAssignTeam(team: TeamColor) {
  if (!store.roomCode || !store.playerId || !beginAction()) return;
  socket.emit(
    'assignTeam',
    { roomCode: store.roomCode, playerId: store.playerId, team },
    actionCallback()
  );
}

function handleAssignRole(role: PlayerRole) {
  if (!store.roomCode || !store.playerId || !beginAction()) return;
  socket.emit(
    'assignRole',
    { roomCode: store.roomCode, playerId: store.playerId, role },
    actionCallback()
  );
}

function handleSetTeamCount(count: number) {
  if (!store.roomCode || !store.playerId || !beginAction()) return;
  socket.emit(
    'setTeamCount',
    { roomCode: store.roomCode, playerId: store.playerId, teamCount: count },
    actionCallback()
  );
}

function handleSetAssassinPenaltyMode(mode: AssassinPenaltyMode) {
  if (!store.roomCode || !store.playerId || !beginAction()) return;
  socket.emit(
    'setAssassinPenaltyMode',
    { roomCode: store.roomCode, playerId: store.playerId, mode },
    actionCallback()
  );
}

function handleFocusCard(cardIndex: number | null) {
  if (!store.roomCode || !store.playerId || !beginAction()) return;
  socket.emit(
    'focusCard',
    { roomCode: store.roomCode, playerId: store.playerId, cardIndex },
    actionCallback()
  );
}

function handleGiveSignal(word: string, number: number) {
  if (!store.roomCode || !store.playerId || !beginAction()) return;
  socket.emit(
    'giveSignal',
    { roomCode: store.roomCode, playerId: store.playerId, word, number },
    actionCallback()
  );
}

function handleRevealCard(cardIndex: number) {
  if (!store.roomCode || !store.playerId || !beginAction()) return;
  socket.emit(
    'revealCard',
    { roomCode: store.roomCode, playerId: store.playerId, cardIndex },
    actionCallback()
  );
}

function handleEndTurn() {
  if (!store.roomCode || !store.playerId || !beginAction()) return;
  socket.emit('endTurn', { roomCode: store.roomCode, playerId: store.playerId }, actionCallback());
}

function handleSkipGuessRound() {
  if (!store.roomCode || !store.playerId || !beginAction()) return;
  socket.emit(
    'skipGuessRound',
    { roomCode: store.roomCode, playerId: store.playerId },
    actionCallback()
  );
}

function handleRestart() {
  if (!store.roomCode || !store.playerId || !beginAction()) return;
  socket.emit(
    'restartGame',
    { roomCode: store.roomCode, playerId: store.playerId },
    actionCallback()
  );
}

function handleSocketConnect() {
  if (store.room && store.roomCode && store.playerId && store.resumeToken) {
    socket.emit(
      'resumePlayer',
      { roomCode: store.roomCode, playerId: store.playerId, resumeToken: store.resumeToken },
      (res) => {
        if (!res.ok) {
          store.clearSession();
          emitAutoJoinRoom();
        }
      }
    );
  } else {
    emitAutoJoinRoom();
  }
}

onMounted(() => {
  if (!props.sessionId) {
    embeddedError.value = 'Missing session info.';
    return;
  }

  socket.on('connect', handleSocketConnect);

  const savedSession = store.loadSession();
  store.reset(); // Clear stale room state from a previous match (e.g. after replay re-mount)
  // Restore the saved token so emitAutoJoinRoom can reclaim the slot on reload.
  if (savedSession) {
    store.setSession(savedSession);
  }

  if (socket.connected) {
    emitAutoJoinRoom();
  } else {
    socket.connect();
  }

  autoJoinRetryTimer = window.setTimeout(() => {
    if (!store.room) {
      autoJoinRetryCount++;
      if (autoJoinRetryCount >= MAX_AUTO_JOIN_RETRIES) {
        embeddedError.value = 'Unable to join the game. Please return to the party and try again.';
        return;
      }
      emitAutoJoinRoom();
    }
  }, 3000);
});

onBeforeUnmount(() => {
  if (actionTimer) clearTimeout(actionTimer);
  actionGeneration += 1;
  if (autoJoinRetryTimer !== undefined) {
    clearTimeout(autoJoinRetryTimer);
  }
  socket.off('roomState', handleRoomState);
  socket.off('connect', handleSocketConnect);
});
</script>

<template>
  <div class="signals-app">
    <div v-if="actionError" class="signals-action-error" role="alert">
      <span>{{ localizeError(actionError, 'secret-signals') }}</span>
      <button type="button" class="ui-btn-secondary" @click="actionError = ''">
        {{ t('secret-signals.dismiss') }}
      </button>
    </div>
    <template v-if="!store.room">
      <p class="py-8 px-4 text-center text-muted">
        {{
          embeddedError
            ? localizeError(embeddedError, 'secret-signals')
            : t('secret-signals.connecting')
        }}
      </p>
    </template>
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
      :pending="actionPending"
      @focus-card="handleFocusCard"
      @give-signal="handleGiveSignal"
      @reveal-card="handleRevealCard"
      @end-turn="handleEndTurn"
      @skip-guess-round="handleSkipGuessRound"
    />
    <GameOver v-else-if="store.phase === 'ended'" @restart="handleRestart" />
  </div>
</template>

<style scoped>
.signals-app {
  min-height: calc(100dvh - 3.5rem);
  background: #102d35;
  font-family:
    system-ui,
    -apple-system,
    BlinkMacSystemFont,
    'Segoe UI',
    sans-serif;
}
.signals-action-error {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  background: #512b2a;
  color: #fff0eb;
  font-size: 0.875rem;
  overflow-wrap: anywhere;
}
.signals-action-error button {
  min-height: 44px;
}
</style>
