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
import { createPendingAction, type ActionIntent } from './lib/pendingAction';

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
const actions = createPendingAction(() => t('secret-signals.actionTimeout'));
const { pending: actionPending, error: actionError } = actions;
const transportReady = ref(false);
let connectionGeneration = 0;
function beginAction(intent: ActionIntent) {
  if (!transportReady.value || !store.room || !store.playerId) return null;
  return actions.begin(intent, store.room, store.playerId);
}
function handleSocketDisconnect() {
  transportReady.value = false;
  connectionGeneration += 1;
  actions.invalidate();
  autoJoinInFlight.value = false;
}
// aria-disabled keeps keyboard focus in place; suppress activation at the boundary too.
function guardPending(event: Event) {
  if (!(event.target instanceof Element)) return;
  if (event.target.closest('[aria-disabled="true"]')) {
    event.preventDefault();
    event.stopPropagation();
  }
}
const autoJoinInFlight = ref(false);
let autoJoinRetryTimer: number | undefined;
let autoJoinRetryCount = 0;
const MAX_AUTO_JOIN_RETRIES = 3;

function handleRoomState(state: Parameters<typeof store.applyRoomState>[0]) {
  actions.reconcile(state);
  store.applyRoomState(state);
  transportReady.value = true;
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
  const generation = connectionGeneration;
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
      if (generation !== connectionGeneration) return;
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
  if (!store.roomCode || !store.playerId) return;
  const callback = beginAction({ kind: 'start' });
  if (!callback) return;
  socket.emit('startGame', { roomCode: store.roomCode, playerId: store.playerId }, callback);
}

function handleAssignTeam(team: TeamColor) {
  if (!store.roomCode || !store.playerId) return;
  const callback = beginAction({ kind: 'team', value: team });
  if (!callback) return;
  socket.emit('assignTeam', { roomCode: store.roomCode, playerId: store.playerId, team }, callback);
}

function handleAssignRole(role: PlayerRole) {
  if (!store.roomCode || !store.playerId) return;
  const callback = beginAction({ kind: 'role', value: role });
  if (!callback) return;
  socket.emit('assignRole', { roomCode: store.roomCode, playerId: store.playerId, role }, callback);
}

function handleSetTeamCount(count: number) {
  if (!store.roomCode || !store.playerId) return;
  const callback = beginAction({ kind: 'teamCount', value: count });
  if (!callback) return;
  socket.emit(
    'setTeamCount',
    { roomCode: store.roomCode, playerId: store.playerId, teamCount: count },
    callback
  );
}

function handleSetAssassinPenaltyMode(mode: AssassinPenaltyMode) {
  if (!store.roomCode || !store.playerId) return;
  const callback = beginAction({ kind: 'penalty', value: mode });
  if (!callback) return;
  socket.emit(
    'setAssassinPenaltyMode',
    { roomCode: store.roomCode, playerId: store.playerId, mode },
    callback
  );
}

function handleFocusCard(cardIndex: number | null) {
  if (!store.roomCode || !store.playerId) return;
  const callback = beginAction({ kind: 'mark', value: cardIndex });
  if (!callback) return;
  socket.emit(
    'focusCard',
    { roomCode: store.roomCode, playerId: store.playerId, cardIndex },
    callback
  );
}

function handleGiveSignal(word: string, number: number) {
  if (!store.roomCode || !store.playerId) return;
  const callback = beginAction({ kind: 'signal', word, number });
  if (!callback) return;
  socket.emit(
    'giveSignal',
    { roomCode: store.roomCode, playerId: store.playerId, word, number },
    callback
  );
}

function handleRevealCard(cardIndex: number) {
  if (!store.roomCode || !store.playerId) return;
  const callback = beginAction({ kind: 'reveal', value: cardIndex });
  if (!callback) return;
  socket.emit(
    'revealCard',
    { roomCode: store.roomCode, playerId: store.playerId, cardIndex },
    callback
  );
}

function handleEndTurn() {
  if (!store.roomCode || !store.playerId) return;
  const callback = beginAction({ kind: 'end' });
  if (!callback) return;
  socket.emit('endTurn', { roomCode: store.roomCode, playerId: store.playerId }, callback);
}

function handleSkipGuessRound() {
  if (!store.roomCode || !store.playerId) return;
  const callback = beginAction({ kind: 'skip' });
  if (!callback) return;
  socket.emit('skipGuessRound', { roomCode: store.roomCode, playerId: store.playerId }, callback);
}

function handleRestart() {
  if (!store.roomCode || !store.playerId) return;
  const callback = beginAction({ kind: 'restart' });
  if (!callback) return;
  socket.emit('restartGame', { roomCode: store.roomCode, playerId: store.playerId }, callback);
}

function handleSocketConnect() {
  const generation = connectionGeneration;
  if (store.room && store.roomCode && store.playerId && store.resumeToken) {
    socket.emit(
      'resumePlayer',
      { roomCode: store.roomCode, playerId: store.playerId, resumeToken: store.resumeToken },
      (res) => {
        if (generation !== connectionGeneration) return;
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
  socket.on('disconnect', handleSocketDisconnect);

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
  connectionGeneration += 1;
  actions.invalidate();
  transportReady.value = false;
  if (autoJoinRetryTimer !== undefined) {
    clearTimeout(autoJoinRetryTimer);
  }
  socket.off('roomState', handleRoomState);
  socket.off('connect', handleSocketConnect);
  socket.off('disconnect', handleSocketDisconnect);
});
</script>

<template>
  <div
    class="signals-app"
    :aria-busy="actionPending || !transportReady"
    @click.capture="guardPending"
    @submit.capture="guardPending"
  >
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
      :pending="actionPending || !transportReady"
      @start-game="handleStartGame"
      @assign-team="handleAssignTeam"
      @assign-role="handleAssignRole"
      @set-team-count="handleSetTeamCount"
      @set-assassin-penalty-mode="handleSetAssassinPenaltyMode"
    />
    <GamePlay
      v-else-if="store.phase === 'playing'"
      :pending="actionPending || !transportReady"
      @focus-card="handleFocusCard"
      @give-signal="handleGiveSignal"
      @reveal-card="handleRevealCard"
      @end-turn="handleEndTurn"
      @skip-guess-round="handleSkipGuessRound"
    />
    <GameOver
      v-else-if="store.phase === 'ended'"
      :pending="actionPending || !transportReady"
      @restart="handleRestart"
    />
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
.signals-app :deep(button[aria-disabled='true']) {
  cursor: not-allowed;
  opacity: 0.55;
}
</style>
