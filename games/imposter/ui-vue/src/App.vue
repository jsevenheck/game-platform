<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { useGameStore } from './stores/game';
import { useSocket } from './composables/useSocket';
import type { HubIntegrationProps } from './types/config';
import Lobby from './components/Lobby.vue';
import DescriptionPhase from './components/DescriptionPhase.vue';
import VotingPhase from './components/VotingPhase.vue';
import RevealPhase from './components/RevealPhase.vue';
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
  joinToken: props.joinToken,
  playerId: props.playerId,
  wsNamespace: props.wsNamespace,
});
const embeddedError = ref('');
const lobbyError = ref('');
const autoJoinInFlight = ref(false);
let autoJoinRetryTimer: number | undefined;
let autoJoinRetryCount = 0;
const MAX_AUTO_JOIN_RETRIES = 3;
let pendingLobbyConfig = Promise.resolve();

socket.on('roomState', (state) => {
  store.applyRoomState(state);
  autoJoinInFlight.value = false;
  autoJoinRetryCount = 0;
  embeddedError.value = '';
  lobbyError.value = '';
  if (state.phase) emit('phase-change', state.phase);
});

socket.on('disconnect', () => {
  autoJoinInFlight.value = false;
});

socket.on('kicked', (reason) => {
  embeddedError.value = reason;
  store.reset();
});

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

async function handleStartGame() {
  if (!store.roomCode || !store.playerId) return;

  await pendingLobbyConfig;
  socket.emit('startGame', { roomCode: store.roomCode, playerId: store.playerId }, () => {});
}

function handleConfigureLobby(config: {
  infiltratorCount: number;
  discussionDurationMs: number;
  targetScore: number;
}) {
  if (!store.roomCode || !store.playerId) return;

  pendingLobbyConfig = pendingLobbyConfig.finally(
    () =>
      new Promise<void>((resolve) => {
        socket.emit(
          'configureLobby',
          { roomCode: store.roomCode!, playerId: store.playerId!, ...config },
          (res) => {
            lobbyError.value = res.ok ? '' : res.error;
            resolve();
          }
        );
      })
  );
}

function handleSubmitWord(word: string) {
  if (!store.roomCode || !store.playerId) return;
  socket.emit('submitWord', { roomCode: store.roomCode, playerId: store.playerId, word }, () => {});
}

function handleKickPlayer(targetId: string) {
  if (!store.roomCode || !store.playerId) return;
  socket.emit(
    'kickPlayer',
    { roomCode: store.roomCode, playerId: store.playerId, targetId },
    (res) => {
      lobbyError.value = res.ok ? '' : res.error;
    }
  );
}

function handleSubmitDescription(description: string) {
  if (!store.roomCode || !store.playerId) return;
  socket.emit(
    'submitDescription',
    { roomCode: store.roomCode, playerId: store.playerId, description },
    () => {}
  );
}

function handleSkipDescriptionTurn() {
  if (!store.roomCode || !store.playerId) return;
  socket.emit(
    'skipDescriptionTurn',
    { roomCode: store.roomCode, playerId: store.playerId },
    () => {}
  );
}

function handleSubmitVote(targetId: string) {
  if (!store.roomCode || !store.playerId) return;
  socket.emit(
    'submitVote',
    { roomCode: store.roomCode, playerId: store.playerId, targetId },
    () => {}
  );
}

function handleGuessWord(guess: string) {
  if (!store.roomCode || !store.playerId) return;
  socket.emit('guessWord', { roomCode: store.roomCode, playerId: store.playerId, guess }, () => {});
}

function handleSkipGuess() {
  if (!store.roomCode || !store.playerId) return;
  socket.emit('skipGuess', { roomCode: store.roomCode, playerId: store.playerId }, () => {});
}

function handleNextRound() {
  if (!store.roomCode || !store.playerId) return;
  socket.emit('nextRound', { roomCode: store.roomCode, playerId: store.playerId }, () => {});
}

function handleEndGame() {
  if (!store.roomCode || !store.playerId) return;
  socket.emit('endGame', { roomCode: store.roomCode, playerId: store.playerId }, () => {});
}

function handleRestart() {
  if (!store.roomCode || !store.playerId) return;
  socket.emit('restartGame', { roomCode: store.roomCode, playerId: store.playerId }, () => {});
}

function handleEmbeddedConnect() {
  if (store.room && store.roomCode && store.playerId && store.resumeToken) {
    socket.emit(
      'resumePlayer',
      { roomCode: store.roomCode, playerId: store.playerId, resumeToken: store.resumeToken },
      (res) => {
        if (!res.ok) {
          store.reset();
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

  socket.on('connect', handleEmbeddedConnect);

  const savedSession = store.loadSession();
  store.reset(); // Clear stale state from a previous match (e.g. after replay re-mount)
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
  if (autoJoinRetryTimer !== undefined) {
    clearTimeout(autoJoinRetryTimer);
  }
  socket.off('connect', handleEmbeddedConnect);
});
</script>

<template>
  <div class="min-h-dvh">
    <p v-if="store.phase === null" class="py-8 px-4 text-center text-muted-foreground">
      {{ embeddedError || 'Connecting...' }}
    </p>
    <Lobby
      v-else-if="store.phase === 'lobby'"
      :error-message="lobbyError"
      @start-game="handleStartGame"
      @configure-lobby="handleConfigureLobby"
      @submit-word="handleSubmitWord"
      @kick-player="handleKickPlayer"
    />
    <DescriptionPhase
      v-else-if="store.phase === 'description'"
      @submit-description="handleSubmitDescription"
      @skip-description-turn="handleSkipDescriptionTurn"
    />
    <VotingPhase
      v-else-if="store.phase === 'discussion' || store.phase === 'voting'"
      @submit-vote="handleSubmitVote"
    />
    <RevealPhase
      v-else-if="store.phase === 'reveal'"
      @guess-word="handleGuessWord"
      @skip-guess="handleSkipGuess"
      @next-round="handleNextRound"
      @end-game="handleEndGame"
      @restart-game="handleRestart"
    />
    <GameOver v-else-if="store.phase === 'ended'" @restart="handleRestart" />
  </div>
</template>
