<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useGameStore } from './stores/game';
import { useSocket } from './composables/useSocket';
import type { RoomView } from '@shared/types';
import Lobby from './components/Lobby.vue';
import QuestionView from './components/QuestionView.vue';
import WaitingView from './components/WaitingView.vue';
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
    wsNamespace: '/g/estimate',
    sessionId: '',
    playerName: '',
    playerId: '',
    joinToken: '',
    isHost: false,
    apiBaseUrl: '',
  }
);

const emit = defineEmits<{
  'phase-change': [phase: string];
}>();

const store = useGameStore();
const { socket, connected } = useSocket({
  apiBaseUrl: props.apiBaseUrl,
  sessionId: props.sessionId,
  joinToken: props.joinToken,
  playerId: props.playerId,
  wsNamespace: props.wsNamespace,
});

type JoinState = 'connecting' | 'joining' | 'ready' | 'error';
type ActionName = 'start' | 'guess' | 'reveal' | 'next';

const joinState = ref<JoinState>('connecting');
const pendingAction = ref<ActionName | null>(null);
const hasRoomUpdate = ref(false);
const hasJoinAck = ref(false);
const phaseRegion = ref<HTMLElement | null>(null);
let joinTimer: ReturnType<typeof setTimeout> | undefined;
let actionTimer: ReturnType<typeof setTimeout> | undefined;
let joinGeneration = 0;
let actionGeneration = 0;
let pendingActionRound = 0;

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
  store.clearError();
  hasJoinAck.value = false;
  const generation = ++joinGeneration;
  joinTimer = setTimeout(() => {
    if (generation !== joinGeneration) return;
    joinGeneration += 1;
    failJoin('Die Spieldaten konnten nicht geladen werden. Bitte erneut versuchen.');
  }, 8_000);
  const saved = store.loadSession();
  socket.emit(
    'autoJoinRoom',
    {
      sessionId: props.sessionId,
      playerId: props.playerId,
      joinToken: props.joinToken,
      resumeToken:
        saved?.sessionId === undefined || saved.sessionId === props.sessionId
          ? store.resumeToken || saved?.resumeToken
          : undefined,
    },
    (res) => {
      if (generation !== joinGeneration) return;
      if (!res.ok) {
        failJoin(res.error);
        return;
      }
      store.roomCode = res.roomCode;
      store.playerId = res.playerId;
      store.playerName = props.playerName;
      store.sessionId = props.sessionId;
      store.resumeToken = res.resumeToken;
      store.saveSession();
      hasJoinAck.value = true;
      if (hasRoomUpdate.value) {
        clearJoinTimer();
        joinState.value = 'ready';
      }
    }
  );
}

function retryConnection() {
  clearJoinTimer();
  store.clearError();
  hasRoomUpdate.value = false;
  joinState.value = connected.value ? 'joining' : 'connecting';
  if (connected.value) joinRoom();
  else socket.connect();
}

function handleDisconnect() {
  clearJoinTimer();
  joinGeneration += 1;
  hasJoinAck.value = false;
  if (actionTimer) clearTimeout(actionTimer);
  actionGeneration += 1;
  pendingAction.value = null;
  hasRoomUpdate.value = false;
  joinState.value = 'connecting';
}

function handleConnectError(error: Error) {
  joinGeneration += 1;
  failJoin(error.message || 'Verbindung zum Spielserver fehlgeschlagen.');
}

function clearPendingAction(clearError = false) {
  if (actionTimer) clearTimeout(actionTimer);
  actionTimer = undefined;
  actionGeneration += 1;
  pendingAction.value = null;
  if (clearError) store.clearError();
}

function resolvePendingActionFromRoom(room: RoomView) {
  const player = room.players.find((candidate) => candidate.id === store.playerId);
  const resolved =
    (pendingAction.value === 'start' && room.phase !== 'lobby') ||
    (pendingAction.value === 'guess' && player?.hasSubmitted === true) ||
    (pendingAction.value === 'reveal' && room.solution !== null) ||
    (pendingAction.value === 'next' &&
      (room.currentRound > pendingActionRound || room.phase === 'ended'));
  if (resolved) clearPendingAction(true);
}

function runAction(
  name: ActionName,
  emitAction: (done: (res: { ok: boolean; error?: string }) => void) => void
) {
  if (pendingAction.value) return;
  store.clearError();
  pendingAction.value = name;
  pendingActionRound = store.room?.currentRound ?? 0;
  const generation = ++actionGeneration;
  if (actionTimer) clearTimeout(actionTimer);
  actionTimer = setTimeout(() => {
    if (generation !== actionGeneration) return;
    actionGeneration += 1;
    pendingAction.value = null;
    actionTimer = undefined;
    store.setError('Der Spielserver hat nicht rechtzeitig geantwortet. Bitte erneut versuchen.');
  }, 8_000);
  emitAction((res) => {
    if (generation !== actionGeneration) return;
    if (actionTimer) clearTimeout(actionTimer);
    actionTimer = undefined;
    pendingAction.value = null;
    if (res.ok) store.clearError();
    else store.setError(res.error ?? 'Die Aktion ist fehlgeschlagen.');
  });
}

function startGame() {
  runAction('start', (done) => socket.emit('startGame', { roomCode: store.roomCode }, done));
}

function submitGuess(guess: number) {
  runAction('guess', (done) =>
    socket.emit(
      'submitGuess',
      { roomCode: store.roomCode, playerId: store.playerId, guess },
      (res) => {
        if (res.ok) store.setMyGuess(guess);
        done(res);
      }
    )
  );
}

function revealSolution() {
  runAction('reveal', (done) => socket.emit('revealSolution', { roomCode: store.roomCode }, done));
}

function nextRound() {
  runAction('next', (done) => socket.emit('nextRound', { roomCode: store.roomCode }, done));
}

function syncAuthority() {
  if (joinState.value !== 'ready' || !connected.value || !store.roomCode) return;
  socket.emit('syncAuthority', { roomCode: store.roomCode }, (res) => {
    if (res.ok) store.clearError();
    else store.setError(res.error);
  });
}

const view = computed(() => {
  switch (store.phase) {
    case 'lobby':
      return 'lobby';
    case 'guessing':
      return store.self?.hasSubmitted ? 'waiting' : 'guessing';
    case 'allSubmitted':
    case 'reveal':
      return 'reveal';
    case 'ended':
      return 'gameOver';
    default:
      return 'lobby';
  }
});

const connectionMessage = computed(() => {
  if (joinState.value === 'connecting') return 'Verbindung zum Spielserver wird hergestellt…';
  if (joinState.value === 'joining') return 'Spielraum wird geladen…';
  return '';
});

const focusKey = computed(
  () =>
    `${joinState.value}:${view.value}:${store.phase}:${store.room?.currentRound ?? 0}:${store.room?.solution === null ? 'hidden' : 'shown'}`
);

watch(focusKey, async () => {
  if (joinState.value !== 'ready') return;
  await nextTick();
  const focusTarget = phaseRegion.value?.querySelector<HTMLElement>('[data-phase-focus]');
  (focusTarget ?? phaseRegion.value)?.focus();
});

watch(() => props.isHost, syncAuthority);

onMounted(() => {
  const saved = store.loadSession();
  store.sessionId = props.sessionId;
  if (
    saved &&
    saved.playerId === props.playerId &&
    (!saved.sessionId || saved.sessionId === props.sessionId)
  ) {
    store.playerId = saved.playerId;
    store.playerName = saved.name;
    store.roomCode = saved.roomCode;
    store.resumeToken = saved.resumeToken;
  }

  socket.on('roomUpdate', (room) => {
    hasRoomUpdate.value = true;
    resolvePendingActionFromRoom(room);
    store.setRoom(room);
    store.clearError();
    if (hasJoinAck.value) {
      clearJoinTimer();
      joinState.value = 'ready';
    }
  });
  socket.on('phaseChange', (data) => emit('phase-change', data.phase));
  socket.on('error', (data) => store.setError(data.message));
  socket.on('connect', joinRoom);
  socket.on('disconnect', handleDisconnect);
  socket.on('connect_error', handleConnectError);
  socket.connect();
});

onBeforeUnmount(() => {
  clearJoinTimer();
  joinGeneration += 1;
  if (actionTimer) clearTimeout(actionTimer);
  actionGeneration += 1;
  socket.off('connect', joinRoom);
  socket.off('disconnect', handleDisconnect);
  socket.off('connect_error', handleConnectError);
  socket.off('roomUpdate');
  socket.off('phaseChange');
  socket.off('error');
});
</script>

<template>
  <main
    ref="phaseRegion"
    class="estimate-app"
    data-testid="estimate-app"
    aria-label="Estimate"
    tabindex="-1"
  >
    <div
      v-if="store.errorMessage"
      class="ui-panel estimate-error"
      role="alert"
      aria-live="assertive"
    >
      <span>{{ store.errorMessage }}</span>
      <button class="ui-btn-secondary" type="button" @click="store.clearError()">Schließen</button>
    </div>

    <section
      v-if="joinState !== 'ready'"
      class="ui-panel estimate-connection"
      :aria-live="joinState === 'error' ? 'assertive' : 'polite'"
      :role="joinState === 'error' ? 'alert' : 'status'"
    >
      <p v-if="connectionMessage">{{ connectionMessage }}</p>
      <button
        v-if="joinState === 'error'"
        class="ui-btn-primary"
        type="button"
        @click="retryConnection"
      >
        Erneut verbinden
      </button>
    </section>

    <Lobby
      v-else-if="view === 'lobby'"
      :players="store.room?.players ?? []"
      :is-host="store.isHost"
      :can-start="store.canStart"
      :pending="pendingAction !== null"
      :total-rounds="store.room?.totalRounds ?? 5"
      @start="startGame"
    />

    <QuestionView
      v-else-if="view === 'guessing' && store.room?.question"
      :question="store.room.question.text"
      :round="store.room.currentRound"
      :total-rounds="store.room.totalRounds"
      :pending="pendingAction !== null"
      @submit="submitGuess"
    />

    <WaitingView
      v-else-if="view === 'waiting'"
      :submitted="store.submittedCount"
      :total="store.totalPlayers"
      :my-guess="store.myGuess"
    />

    <RevealView
      v-else-if="view === 'reveal' && store.room"
      :room="store.room"
      :is-host="store.isHost"
      :my-id="store.playerId"
      :pending="pendingAction !== null"
      @reveal="revealSolution"
      @next="nextRound"
    />

    <GameOver
      v-else-if="view === 'gameOver' && store.room"
      :scores="store.room.scores"
      :my-score="store.myScore"
    />
  </main>
</template>

<style scoped>
.estimate-app {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 1rem;
  width: min(100%, 64rem);
  min-height: 100%;
  margin: 0 auto;
  padding: clamp(1rem, 4vw, 2rem);
  outline: none;
}

.estimate-error,
.estimate-connection {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.estimate-error {
  color: var(--color-danger, #fca5a5);
  border-color: currentColor;
}

@media (max-width: 480px) {
  .estimate-app {
    padding: 4rem 0.75rem 1rem;
  }
}
</style>
