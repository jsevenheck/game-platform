<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue';
import { useGameStore } from './stores/game';
import { useSocket, type BlackoutSocket } from './composables/useSocket';
import type { HubIntegrationProps } from './types/config';
import type { Language, RoomView } from '@shared/types';
import Header from './panels/Header.vue';
import PlayersPanel from './panels/PlayersPanel.vue';
import Landing from './components/Landing.vue';
import Lobby from './components/Lobby.vue';
import GameRound from './components/GameRound.vue';
import Scoreboard from './components/Scoreboard.vue';
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
const error = ref('');
const embeddedError = ref('');
let socket: BlackoutSocket;
let retryTimer: number | undefined;
let standaloneConnectHandler: (() => void) | undefined;

const isEmbedded = !!props.wsNamespace;
const embeddedPlayerName = () => props.playerName || props.playerId || 'Player';

function initSocket() {
  const { socket: s } = useSocket({
    apiBaseUrl: props.apiBaseUrl,
    sessionId: props.sessionId,
    joinToken: props.joinToken,
    playerId: props.playerId,
    wsNamespace: props.wsNamespace,
  });
  socket = s;
  socket.on('roomUpdate', handleRoomUpdate);
}

function clearEmbeddedRetryTimer() {
  if (retryTimer !== undefined) {
    clearTimeout(retryTimer);
    retryTimer = undefined;
  }
}

function handleRoomUpdate(room: RoomView) {
  store.setRoom(room);
  embeddedError.value = '';
  clearEmbeddedRetryTimer();
  emit('phase-change', room.phase);
}

function handleCreate(name: string) {
  error.value = '';
  socket.emit('createRoom', { name }, (res) => {
    if (res.ok) {
      store.playerId = res.playerId;
      store.playerName = name;
      store.roomCode = res.roomCode;
      store.resumeToken = res.resumeToken;
      store.saveSession();
    } else {
      error.value = res.error;
    }
  });
}

function handleJoin(name: string, code: string) {
  error.value = '';
  socket.emit('joinRoom', { name, code }, (res) => {
    if (res.ok) {
      store.playerId = res.playerId;
      store.playerName = name;
      store.roomCode = code;
      store.resumeToken = res.resumeToken;
      store.saveSession();
    } else {
      error.value = res.error;
    }
  });
}

function handleLeave() {
  socket.emit('leaveRoom', { roomCode: store.roomCode, playerId: store.playerId });
  store.clearSession();
}

function handleUpdateMaxRounds(rounds: number) {
  socket.emit('updateMaxRounds', {
    roomCode: store.roomCode,
    playerId: store.playerId,
    maxRounds: rounds,
  });
}

function handleUpdateRoomSettings(settings: { language: Language; excludedLetters: string[] }) {
  socket.emit('updateRoomSettings', {
    roomCode: store.roomCode,
    playerId: store.playerId,
    language: settings.language,
    excludedLetters: settings.excludedLetters,
  });
}

function handleStartGame() {
  socket.emit('startGame', { roomCode: store.roomCode, playerId: store.playerId }, (res) => {
    if (!res.ok) {
      error.value = res.error;
    }
  });
}

function handleReveal() {
  socket.emit('revealCategory', { roomCode: store.roomCode, playerId: store.playerId });
}

function handleReroll() {
  socket.emit('rerollPrompt', { roomCode: store.roomCode, playerId: store.playerId });
}

function handleSelectWinner(winnerId: string) {
  socket.emit('selectWinner', { roomCode: store.roomCode, playerId: store.playerId, winnerId });
}

function handleSkip() {
  socket.emit('skipRound', { roomCode: store.roomCode, playerId: store.playerId });
}

function handleRestart() {
  socket.emit('restartGame', { roomCode: store.roomCode, playerId: store.playerId });
}

function emitAutoJoinRoom() {
  if (!props.sessionId || !socket.connected) {
    return;
  }

  embeddedError.value = '';
  socket.emit(
    'autoJoinRoom',
    {
      sessionId: props.sessionId,
      playerId: props.playerId || '',
      name: embeddedPlayerName(),
      isHost: props.isHost,
      resumeToken: store.resumeToken || undefined,
    },
    (res) => {
      if (res.ok) {
        store.playerId = res.playerId;
        store.playerName = embeddedPlayerName();
        store.roomCode = res.roomCode;
        store.resumeToken = res.resumeToken;
        store.saveSession();
      } else {
        embeddedError.value = res.error;
      }
    }
  );
}

function retryEmbeddedJoin() {
  embeddedError.value = '';
  if (socket.connected) {
    emitAutoJoinRoom();
    return;
  }
  socket.connect();
}

function handleEmbeddedConnect() {
  emitAutoJoinRoom();
}

function handleEmbeddedConnectError() {
  if (!store.room) {
    embeddedError.value = 'Connection failed. Please retry.';
  }
}

function resumeStandaloneSession(session: {
  roomCode: string;
  playerId: string;
  resumeToken: string;
}): void {
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
      }
    }
  );
}

onMounted(() => {
  initSocket();

  // Try to resume session
  if (isEmbedded) {
    if (!props.sessionId) {
      embeddedError.value = 'Missing session info.';
      return;
    }

    // Restore saved game session so the token is available for slot reclaim on reload.
    const savedSession = store.loadSession();
    if (savedSession) {
      store.playerId = savedSession.playerId;
      store.playerName = savedSession.name;
      store.roomCode = savedSession.roomCode;
      store.resumeToken = savedSession.resumeToken;
    }

    socket.on('connect', handleEmbeddedConnect);
    socket.on('connect_error', handleEmbeddedConnectError);

    if (socket.connected) {
      emitAutoJoinRoom();
    } else {
      // The host app's platform socket may have created a shared Socket.IO
      // manager with autoConnect disabled, so the game namespace must connect
      // explicitly instead of relying on the client default.
      socket.connect();
    }
    // Retry after 3 s if the room hasn't loaded yet (guards against missed
    // connect events or lost ack/roomUpdate on first connection attempt).
    retryTimer = window.setTimeout(() => {
      if (!store.room) {
        emitAutoJoinRoom();
      }
    }, 3000);
  } else {
    const session = store.loadSession();
    if (session) {
      store.playerId = session.playerId;
      store.playerName = session.name;
      store.roomCode = session.roomCode;
      store.resumeToken = session.resumeToken;

      standaloneConnectHandler = () => {
        resumeStandaloneSession(session);
      };
      socket.on('connect', standaloneConnectHandler);

      if (socket.connected) {
        resumeStandaloneSession(session);
      } else {
        socket.connect();
      }
    } else if (!socket.connected) {
      socket.connect();
    }
  }
});

onBeforeUnmount(() => {
  clearEmbeddedRetryTimer();
  socket.off('roomUpdate', handleRoomUpdate);
  socket.off('connect', handleEmbeddedConnect);
  socket.off('connect_error', handleEmbeddedConnectError);
  if (standaloneConnectHandler) {
    socket.off('connect', standaloneConnectHandler);
  }
});
</script>

<template>
  <div class="min-h-dvh">
    <Header v-if="store.room" @leave="handleLeave" />

    <main class="mx-auto max-w-[600px] p-4">
      <template v-if="!store.room && isEmbedded">
        <p class="mt-8 text-center text-muted">
          {{ embeddedError || 'Connecting...' }}
        </p>
        <button
          v-if="embeddedError"
          class="ui-btn-secondary mx-auto mt-4 block"
          type="button"
          @click="retryEmbeddedJoin"
        >
          Retry
        </button>
      </template>
      <Landing v-else-if="!store.room" @create="handleCreate" @join="handleJoin" />
      <Lobby
        v-else-if="store.phase === 'lobby'"
        @update-max-rounds="handleUpdateMaxRounds"
        @update-room-settings="handleUpdateRoomSettings"
        @start-game="handleStartGame"
      />
      <GameRound
        v-else-if="store.phase === 'playing'"
        @reveal="handleReveal"
        @reroll="handleReroll"
        @select-winner="handleSelectWinner"
        @skip="handleSkip"
      />
      <Scoreboard v-else-if="store.phase === 'roundEnd'" />
      <GameOver v-else-if="store.phase === 'ended'" @restart="handleRestart" />
    </main>

    <PlayersPanel v-if="store.room" />

    <p
      v-if="error"
      class="fixed bottom-4 left-1/2 -translate-x-1/2 rounded-[--radius-md] bg-danger-muted px-6 py-3 text-sm text-danger"
    >
      {{ error }}
    </p>
  </div>
</template>
