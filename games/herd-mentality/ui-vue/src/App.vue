<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { RoomView } from '@shared/types';
import { useGameStore } from './stores/game';
import { useSocket } from './composables/useSocket';
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
    wsNamespace: '/g/herd-mentality',
    sessionId: '',
    playerName: '',
    playerId: '',
    joinToken: '',
    isHost: false,
    apiBaseUrl: '',
  }
);
const emit = defineEmits<{ 'phase-change': [phase: string] }>();
const store = useGameStore();
const { socket, connected } = useSocket({
  apiBaseUrl: props.apiBaseUrl,
  sessionId: props.sessionId,
  joinToken: props.joinToken,
  playerId: props.playerId,
  wsNamespace: props.wsNamespace,
});
const joinState = ref<'connecting' | 'joining' | 'ready' | 'error'>('connecting');
const pending = ref<'start' | 'answer' | 'reveal' | 'next' | null>(null);
const phaseRegion = ref<HTMLElement | null>(null);
let joinTimeout: ReturnType<typeof setTimeout> | undefined;

function fail(message: string) {
  joinState.value = 'error';
  store.setError(message);
}
function joinRoom() {
  if (!connected.value) return;
  joinState.value = 'joining';
  const saved = store.loadSession();
  if (joinTimeout) clearTimeout(joinTimeout);
  joinTimeout = setTimeout(() => fail('Der Spielraum konnte nicht geladen werden.'), 8000);
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
        fail(response.error);
        return;
      }
      store.roomCode = response.roomCode;
      store.playerId = response.playerId;
      store.playerName = props.playerName;
      store.sessionId = props.sessionId;
      store.resumeToken = response.resumeToken;
      store.saveSession();
      if (joinTimeout) clearTimeout(joinTimeout);
      joinState.value = 'ready';
    }
  );
}
function action(
  name: NonNullable<typeof pending>,
  run: (done: (response: { ok: true } | { ok: false; error: string }) => void) => void
) {
  if (pending.value) return;
  pending.value = name;
  store.clearError();
  run((response) => {
    pending.value = null;
    if (response.ok) store.clearError();
    else store.setError(response.error);
  });
}
function startGame() {
  action('start', (done) => socket.emit('startGame', { roomCode: store.roomCode }, done));
}
function submitAnswer(answer: string) {
  action('answer', (done) =>
    socket.emit('submitAnswer', { roomCode: store.roomCode, answer }, (response) => {
      if (response.ok) store.setMyAnswer(answer);
      done(response);
    })
  );
}
function revealAnswers() {
  action('reveal', (done) => socket.emit('revealAnswers', { roomCode: store.roomCode }, done));
}
function nextRound() {
  action('next', (done) => socket.emit('nextRound', { roomCode: store.roomCode }, done));
}
function retry() {
  store.clearError();
  joinRoom();
}

const view = computed(() => {
  if (store.phase === 'lobby') return 'lobby';
  if (store.phase === 'answering') return store.self?.hasSubmitted ? 'waiting' : 'answering';
  if (store.phase === 'allSubmitted' || store.phase === 'reveal') return 'reveal';
  return 'ended';
});
const focusKey = computed(
  () => `${joinState.value}:${view.value}:${store.room?.currentRound ?? 0}:${store.phase}`
);
watch(focusKey, async () => {
  if (joinState.value !== 'ready') return;
  await nextTick();
  (
    phaseRegion.value?.querySelector<HTMLElement>('[data-phase-focus]') ?? phaseRegion.value
  )?.focus();
});
watch(
  () => store.phase,
  (phase) => emit('phase-change', phase)
);

onMounted(() => {
  socket.on('roomUpdate', (room: RoomView) => {
    store.setRoom(room);
    joinState.value = 'ready';
  });
  socket.on('phaseChange', ({ phase }) => emit('phase-change', phase));
  socket.on('error', ({ message }) => store.setError(message));
  socket.on('connect', joinRoom);
  socket.on('disconnect', () => {
    joinState.value = 'connecting';
  });
  socket.on('connect_error', (error) => fail(error.message || 'Verbindung fehlgeschlagen.'));
  socket.connect();
});
onBeforeUnmount(() => {
  if (joinTimeout) clearTimeout(joinTimeout);
  socket.off('roomUpdate');
  socket.off('phaseChange');
  socket.off('error');
  socket.off('connect', joinRoom);
  socket.off('disconnect');
  socket.off('connect_error');
});
</script>
<template>
  <main
    ref="phaseRegion"
    class="herd-mentality-app"
    data-testid="herd-mentality-app"
    aria-label="Herd Mentality"
    tabindex="-1"
  >
    <div v-if="store.errorMessage" class="ui-panel herd-error" role="alert" aria-live="assertive">
      <span>{{ store.errorMessage }}</span
      ><button class="ui-btn-secondary" type="button" @click="store.clearError">Schließen</button>
    </div>
    <section
      v-if="joinState !== 'ready'"
      class="ui-panel"
      :role="joinState === 'error' ? 'alert' : 'status'"
      aria-live="polite"
    >
      <p>
        {{
          joinState === 'error' ? 'Die Verbindung ist fehlgeschlagen.' : 'Spielraum wird geladen…'
        }}
      </p>
      <button v-if="joinState === 'error'" class="ui-btn-primary mt-3" type="button" @click="retry">
        Erneut verbinden
      </button>
    </section>
    <Lobby
      v-else-if="view === 'lobby'"
      :players="store.room?.players ?? []"
      :is-host="store.isHost"
      :can-start="store.canStart"
      :pending="pending === 'start'"
      :total-rounds="store.room?.totalRounds ?? 8"
      @start="startGame"
    />
    <QuestionView
      v-else-if="view === 'answering' && store.room?.prompt"
      :prompt="store.room.prompt.text"
      :round="store.room.currentRound"
      :total-rounds="store.room.totalRounds"
      :pending="pending === 'answer'"
      @submit="submitAnswer"
    />
    <WaitingView
      v-else-if="view === 'waiting'"
      :submitted="store.submittedCount"
      :total="store.connectedCount"
      :my-answer="store.myAnswer"
    />
    <RevealView
      v-else-if="view === 'reveal' && store.room"
      :room="store.room"
      :is-host="store.isHost"
      :pending="pending === 'reveal' || pending === 'next'"
      @reveal="revealAnswers"
      @next="nextRound"
    />
    <template v-else-if="view === 'ended' && store.room"
      ><RevealView
        :room="store.room"
        :is-host="false"
        :pending="false"
        @reveal="revealAnswers"
        @next="nextRound" /><GameOver :scores="store.room.scores"
    /></template>
  </main>
</template>
<style scoped>
.herd-mentality-app {
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
.herd-error {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  color: var(--color-danger);
  border-color: currentColor;
}
@media (max-width: 480px) {
  .herd-mentality-app {
    padding: 4rem 0.75rem 1rem;
  }
}
</style>
