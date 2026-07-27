<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
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

const initError = ref('');

function joinRoom() {
  socket.emit(
    'autoJoinRoom',
    {
      sessionId: props.sessionId,
      name: props.playerName,
      playerId: props.playerId,
      joinToken: props.joinToken,
      isHost: props.isHost,
    },
    (res) => {
      if (!res.ok) {
        initError.value = res.error;
        store.setError(res.error);
        return;
      }
      store.roomCode = res.roomCode;
      store.playerId = res.playerId;
      store.playerName = props.playerName;
      store.resumeToken = res.resumeToken;
      store.saveSession();
    }
  );
}

function startGame() {
  socket.emit('startGame', { roomCode: store.roomCode }, (res) => {
    if (!res.ok) store.setError(res.error);
  });
}

function submitGuess(guess: number) {
  socket.emit(
    'submitGuess',
    { roomCode: store.roomCode, playerId: store.playerId, guess },
    (res) => {
      if (!res.ok) store.setError(res.error);
    }
  );
}

function revealSolution() {
  socket.emit('revealSolution', { roomCode: store.roomCode }, (res) => {
    if (!res.ok) store.setError(res.error);
  });
}

function nextRound() {
  socket.emit('nextRound', { roomCode: store.roomCode }, (res) => {
    if (!res.ok) store.setError(res.error);
  });
}

function restartGame() {
  socket.emit('restartGame', { roomCode: store.roomCode }, (res) => {
    if (!res.ok) store.setError(res.error);
  });
}

const view = computed(() => {
  switch (store.phase) {
    case 'lobby':
      return 'lobby';
    case 'guessing':
      return store.self?.hasSubmitted ? 'waiting' : 'guessing';
    case 'allSubmitted':
      return 'reveal';
    case 'reveal':
      return 'reveal';
    case 'gameEnd':
      return 'gameOver';
    default:
      return 'lobby';
  }
});

onMounted(() => {
  socket.on('roomUpdate', (room) => {
    store.setRoom(room);
  });
  socket.on('phaseChange', (data) => {
    emit('phase-change', data.phase);
  });
  socket.on('error', (data) => {
    store.setError(data.message);
  });
  socket.on('connect', joinRoom);
  socket.connect();
});

onBeforeUnmount(() => {
  socket.off('connect', joinRoom);
  socket.off('roomUpdate');
  socket.off('phaseChange');
  socket.off('error');
  socket.disconnect();
});
</script>

<template>
  <div class="estimate-app" data-testid="estimate-app">
    <div v-if="initError" class="ui-panel bg-danger-muted text-danger p-3" role="alert">
      {{ initError }}
    </div>

    <div v-if="!connected" class="ui-panel p-3 text-muted-foreground">Verbinde…</div>

    <Lobby
      v-else-if="view === 'lobby'"
      :players="store.room?.players ?? []"
      :is-host="props.isHost"
      :can-start="store.canStart"
      :total-rounds="store.room?.totalRounds ?? 5"
      @start="startGame"
    />

    <QuestionView
      v-else-if="view === 'guessing' && store.room?.question"
      :question="store.room.question.text"
      :round="store.room.currentRound"
      :total-rounds="store.room.totalRounds"
      @submit="submitGuess"
    />

    <WaitingView
      v-else-if="view === 'waiting'"
      :submitted="store.submittedCount"
      :total="store.totalPlayers"
    />

    <RevealView
      v-else-if="view === 'reveal' && store.room"
      :room="store.room"
      :is-host="props.isHost"
      :my-id="store.playerId"
      @reveal="revealSolution"
      @next="nextRound"
    />

    <GameOver
      v-else-if="view === 'gameOver' && store.room"
      :scores="store.room.scores"
      :winners="store.room.winners"
      :is-host="props.isHost"
      :my-score="store.myScore"
      @restart="restartGame"
    />
  </div>
</template>

<style scoped>
.estimate-app {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1.5rem;
  min-height: 100%;
}
</style>
