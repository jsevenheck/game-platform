<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { useGameStore } from './stores/game';
import { useSocket } from './composables/useSocket';
import type { HubIntegrationProps } from './types/config';
import Landing from './components/Landing.vue';
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
const isEmbedded = !!props.wsNamespace;
const embeddedError = ref('');
const landingError = ref('');
const lobbyError = ref('');
const autoJoinInFlight = ref(false);
let autoJoinRetryTimer: number | undefined;
let pendingLobbyConfig = Promise.resolve();

socket.on('roomState', (state) => {
  store.applyRoomState(state);
  autoJoinInFlight.value = false;
  embeddedError.value = '';
  lobbyError.value = '';
  if (state.phase) emit('phase-change', state.phase);
});

socket.on('disconnect', () => {
  autoJoinInFlight.value = false;
});

socket.on('kicked', (reason) => {
  if (isEmbedded) {
    embeddedError.value = reason;
    store.reset();
    return;
  }

  lobbyError.value = '';
  embeddedError.value = '';
  store.clearSession();
  landingError.value = reason;

  if (socket.connected) {
    socket.disconnect();
  }
  socket.connect();
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

function finalizeLeave() {
  landingError.value = '';
  lobbyError.value = '';
  embeddedError.value = '';
  store.clearSession();

  if (socket.connected) {
    socket.disconnect();
  }

  if (!isEmbedded) {
    socket.connect();
  }
}

function handleLeave() {
  if (!store.roomCode || !store.playerId || isEmbedded) {
    return;
  }

  socket.emit('leaveRoom', { roomCode: store.roomCode, playerId: store.playerId }, (res) => {
    if (!res.ok) {
      landingError.value = res.error;
      return;
    }

    finalizeLeave();
  });
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
  if (isEmbedded && props.sessionId) {
    const savedSession = store.loadSession();
    store.reset(); // Clear stale state from a previous match (e.g. after replay re-mount)
    // Restore the saved token so emitAutoJoinRoom can reclaim the slot on reload.
    if (savedSession) {
      store.setSession(savedSession);
    }
    socket.on('connect', handleEmbeddedConnect);

    if (socket.connected) {
      emitAutoJoinRoom();
    } else {
      socket.connect();
    }

    autoJoinRetryTimer = window.setTimeout(() => {
      if (!store.room) {
        emitAutoJoinRoom();
      }
    }, 3000);
    return;
  }

  const session = store.loadSession();
  if (!session) return;

  const doResume = () => {
    socket.emit(
      'resumePlayer',
      { roomCode: session.roomCode, playerId: session.playerId, resumeToken: session.resumeToken },
      (res) => {
        if (res.ok) {
          store.setSession({
            playerId: session.playerId,
            roomCode: session.roomCode,
            resumeToken: session.resumeToken,
            name: session.name,
          });
        } else {
          store.clearSession();
        }
      }
    );
  };

  if (socket.connected) {
    doResume();
  } else {
    socket.once('connect', doResume);
  }
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
    <header v-if="store.room && !isEmbedded" class="imposter-header ui-shell-header">
      <span class="text-imposter text-xs font-extrabold uppercase tracking-[0.16em]">{{
        store.roomCode
      }}</span>
      <button
        class="ui-btn-ghost !rounded-full !px-4 !py-1.5 !text-sm border border-border-strong hover:!border-danger hover:!text-danger"
        type="button"
        @click="handleLeave"
      >
        Leave
      </button>
    </header>
    <p
      v-if="store.phase === null && isEmbedded"
      class="py-8 px-4 text-center text-muted-foreground"
    >
      {{ embeddedError || 'Connecting...' }}
    </p>
    <Landing
      v-else-if="store.phase === null"
      :server-error="landingError"
      @create="handleCreate"
      @join="handleJoin"
    />
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
