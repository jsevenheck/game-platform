<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { localizeError } from '@platform/i18n/serverError';
import type { StrokePoint } from '@shared/types';
import './i18n';
import { useGameStore } from './stores/game';
import { useSocket } from './composables/useSocket';
import Lobby from './components/Lobby.vue';
import DrawingView from './components/DrawingView.vue';
import VotingView from './components/VotingView.vue';
import AgentGuessView from './components/AgentGuessView.vue';
import RevealView from './components/RevealView.vue';
import GameOver from './components/GameOver.vue';

const props = withDefaults(
  defineProps<{
    wsNamespace?: string;
    sessionId?: string;
    playerName?: string;
    playerId?: string;
    joinToken?: string;
    isHost?: boolean;
    apiBaseUrl?: string;
  }>(),
  {
    wsNamespace: '/g/kritzelagent',
    sessionId: '',
    playerName: '',
    playerId: '',
    joinToken: '',
    isHost: false,
    apiBaseUrl: '',
  }
);
const emit = defineEmits<{ 'phase-change': [phase: string] }>();
const { t } = useI18n();
const store = useGameStore();
const { socket, connected } = useSocket(props);
const joinState = ref<'connecting' | 'joining' | 'ready' | 'error'>('connecting');
const pending = ref(false);
const pendingKind = ref<'start' | 'rounds' | 'other'>('other');
const hasJoinAck = ref(false);
const phaseRegion = ref<HTMLElement | null>(null);
let joinTimer: ReturnType<typeof setTimeout> | undefined;

function clearJoinTimer() {
  if (joinTimer) clearTimeout(joinTimer);
  joinTimer = undefined;
}

function failJoin(message: string) {
  clearJoinTimer();
  joinState.value = 'error';
  store.setError(message);
}

function joinRoom() {
  clearJoinTimer();
  joinState.value = 'joining';
  hasJoinAck.value = false;
  const saved = store.loadSession();
  joinTimer = setTimeout(() => failJoin(t('kritzelagent.joinTimeout')), 8000);
  socket.emit(
    'autoJoinRoom',
    {
      sessionId: props.sessionId,
      playerId: props.playerId,
      joinToken: props.joinToken,
      resumeToken: saved?.sessionId === props.sessionId ? saved.resumeToken : undefined,
    },
    (response) => {
      if (!response.ok) {
        failJoin(response.error);
        return;
      }
      clearJoinTimer();
      store.roomCode = response.roomCode;
      store.playerId = response.playerId;
      store.playerName = props.playerName;
      store.sessionId = props.sessionId;
      store.resumeToken = response.resumeToken;
      store.saveSession();
      hasJoinAck.value = true;
      if (store.room) joinState.value = 'ready';
    }
  );
}

function retryConnection() {
  store.clearError();
  hasJoinAck.value = false;
  if (connected.value) joinRoom();
  else {
    joinState.value = 'connecting';
    socket.connect();
  }
}

function runAction(
  action: (done: (response: { ok: boolean; error?: string }) => void) => void,
  kind: 'start' | 'rounds' | 'other' = 'other'
) {
  if (pending.value) return;
  pending.value = true;
  pendingKind.value = kind;
  store.clearError();
  action((response) => {
    pending.value = false;
    if (response.ok) store.clearError();
    else store.setError(response.error ?? t('kritzelagent.actionFailed'));
  });
}

function startGame() {
  runAction((done) => socket.emit('startGame', { roomCode: store.roomCode }, done), 'start');
}
function setRounds(totalRounds: number) {
  runAction(
    (done) => socket.emit('setTotalRounds', { roomCode: store.roomCode, totalRounds }, done),
    'rounds'
  );
}
function submitStroke(points: StrokePoint[]) {
  runAction((done) => socket.emit('submitStroke', { roomCode: store.roomCode, points }, done));
}
function submitVote(targetPlayerId: string) {
  runAction((done) =>
    socket.emit('submitVote', { roomCode: store.roomCode, targetPlayerId }, done)
  );
}
function submitAgentGuess(guess: string) {
  runAction((done) => socket.emit('submitAgentGuess', { roomCode: store.roomCode, guess }, done));
}
function nextRound() {
  runAction((done) => socket.emit('nextRound', { roomCode: store.roomCode }, done));
}

function syncAuthority() {
  if (joinState.value !== 'ready' || !store.roomCode || !connected.value) return;
  socket.emit('syncAuthority', { roomCode: store.roomCode }, (response) => {
    if (!response.ok) store.setError(response.error);
  });
}

const view = computed(() => {
  if (store.phase === 'agentGuess') return store.assignment?.isAgent ? 'agentGuess' : 'waiting';
  return store.phase;
});
const focusKey = computed(
  () => `${joinState.value}:${view.value}:${store.room?.currentRound ?? 0}`
);
watch(focusKey, async () => {
  if (joinState.value !== 'ready') return;
  await nextTick();
  const focusTarget = phaseRegion.value?.querySelector<HTMLElement>('[data-phase-focus]');
  (focusTarget ?? phaseRegion.value)?.focus();
});
watch(() => props.isHost, syncAuthority);

onMounted(() => {
  store.sessionId = props.sessionId;
  const saved = store.loadSession();
  if (saved?.playerId === props.playerId && saved.sessionId === props.sessionId) {
    store.playerId = saved.playerId;
    store.playerName = saved.name;
    store.roomCode = saved.roomCode;
    store.resumeToken = saved.resumeToken;
  }
  socket.on('roomUpdate', (room) => {
    store.setRoom(room);
    if (hasJoinAck.value) joinState.value = 'ready';
  });
  socket.on('privateAssignment', (assignment) => store.setAssignment(assignment));
  socket.on('phaseChange', (data) => emit('phase-change', data.phase));
  socket.on('error', (data) => store.setError(data.message));
  socket.on('connect', joinRoom);
  socket.on('disconnect', () => {
    clearJoinTimer();
    joinState.value = 'connecting';
    pending.value = false;
  });
  socket.on('connect_error', (error) =>
    failJoin(error.message || t('kritzelagent.connectionFailed'))
  );
  socket.connect();
});

onBeforeUnmount(() => {
  clearJoinTimer();
  socket.off('connect', joinRoom);
  socket.off('roomUpdate');
  socket.off('privateAssignment');
  socket.off('phaseChange');
  socket.off('error');
  socket.off('disconnect');
  socket.off('connect_error');
});
</script>

<template>
  <main
    ref="phaseRegion"
    class="kritzelagent-app"
    data-testid="kritzelagent-app"
    aria-label="Kritzelagent"
    tabindex="-1"
  >
    <div
      v-if="store.errorMessage"
      class="ui-panel kritzelagent-error"
      role="alert"
      aria-live="assertive"
    >
      <span>{{ localizeError(store.errorMessage, 'kritzelagent') }}</span>
      <button class="ui-btn-secondary" type="button" @click="store.clearError()">
        {{ t('kritzelagent.dismiss') }}
      </button>
    </div>
    <section
      v-if="joinState !== 'ready'"
      class="ui-panel kritzelagent-connection"
      :role="joinState === 'error' ? 'alert' : 'status'"
      aria-live="polite"
    >
      <p v-if="joinState === 'connecting'">{{ t('kritzelagent.connecting') }}</p>
      <p v-else-if="joinState === 'joining'">{{ t('kritzelagent.joining') }}</p>
      <p v-else>{{ t('kritzelagent.joinFailed') }}</p>
      <button
        v-if="joinState === 'error'"
        class="ui-btn-primary"
        type="button"
        @click="retryConnection"
      >
        {{ t('kritzelagent.reconnect') }}
      </button>
    </section>
    <Lobby
      v-else-if="view === 'lobby'"
      :players="store.room?.players ?? []"
      :is-host="store.isHost"
      :can-start="store.canStart"
      :pending="pending && pendingKind === 'start'"
      :settings-pending="pending && pendingKind === 'rounds'"
      :total-rounds="store.room?.totalRounds ?? 5"
      @start="startGame"
      @set-rounds="setRounds"
    />
    <DrawingView
      v-else-if="view === 'drawing' && store.room"
      :room="store.room"
      :assignment="store.assignment"
      :can-draw="store.canDraw"
      :pending="pending"
      @stroke="submitStroke"
    />
    <VotingView
      v-else-if="view === 'voting' && store.room"
      :room="store.room"
      :my-id="store.playerId"
      :pending="pending"
      @vote="submitVote"
    />
    <AgentGuessView
      v-else-if="view === 'agentGuess' && store.assignment"
      :topic-category="store.assignment.category"
      :pending="pending"
      @guess="submitAgentGuess"
    />
    <section v-else-if="view === 'waiting'" class="ui-panel" aria-live="polite">
      <h2 data-phase-focus tabindex="-1">{{ t('kritzelagent.waiting.title') }}</h2>
      <p class="mt-2 text-muted-foreground">{{ t('kritzelagent.waiting.hint') }}</p>
    </section>
    <RevealView
      v-else-if="view === 'reveal' && store.room"
      :room="store.room"
      :is-host="store.isHost"
      :pending="pending"
      @next="nextRound"
    />
    <GameOver v-else-if="view === 'ended' && store.room" :scores="store.room.scores" />
  </main>
</template>

<style scoped>
.kritzelagent-app {
  display: flex;
  flex: 0 1 64rem;
  flex-direction: column;
  gap: 1rem;
  width: 100%;
  max-width: 64rem;
  min-width: 0;
  min-height: 100%;
  margin: 0 auto;
  padding: clamp(1rem, 4vw, 2rem);
  box-sizing: border-box;
  outline: none;
}
.kritzelagent-error,
.kritzelagent-connection {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}
.kritzelagent-error {
  color: var(--color-danger, #fca5a5);
  border-color: currentColor;
}
@media (max-width: 640px) {
  .kritzelagent-app {
    padding-top: 4rem;
  }
}
</style>
