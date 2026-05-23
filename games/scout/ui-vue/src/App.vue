<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import type { RoomView } from '@shared/types';
import { useGameStore } from './stores/game';
import { useSocket, type ScoutSocket } from './composables/useSocket';
import type { HubIntegrationProps } from './types/config';
import Lobby from './components/Lobby.vue';
import SetupFlip from './components/SetupFlip.vue';
import GameTable from './components/GameTable.vue';
import GameOver from './components/GameOver.vue';

const props = withDefaults(defineProps<HubIntegrationProps>(), {
  playerId: undefined,
  playerName: undefined,
  sessionId: undefined,
  wsNamespace: undefined,
  apiBaseUrl: undefined,
  isHost: undefined,
});

const emit = defineEmits<{ 'phase-change': [phase: string] }>();

const store = useGameStore();
const embeddedError = ref('');
let socket: ScoutSocket;
let retryTimer: number | undefined;
let phaseChangeTimer: ReturnType<typeof setTimeout> | null = null;
const GAME_OVER_OVERLAY_DELAY_MS = 2500;

const displayName = () => props.playerName || props.playerId || 'Player';

function clearRetryTimer() {
  if (retryTimer !== undefined) {
    clearTimeout(retryTimer);
    retryTimer = undefined;
  }
}

function commitRoomUpdate(room: RoomView) {
  store.setRoom(room);
  embeddedError.value = '';
  clearRetryTimer();

  if (room.phase === 'ended') {
    if (phaseChangeTimer) clearTimeout(phaseChangeTimer);
    phaseChangeTimer = setTimeout(() => {
      phaseChangeTimer = null;
      emit('phase-change', 'ended');
    }, GAME_OVER_OVERLAY_DELAY_MS);
  } else {
    if (phaseChangeTimer) {
      clearTimeout(phaseChangeTimer);
      phaseChangeTimer = null;
    }
    emit('phase-change', room.phase);
  }
}

function emitAutoJoinRoom() {
  if (!props.sessionId || !socket.connected) return;
  embeddedError.value = '';
  socket.emit(
    'autoJoinRoom',
    {
      sessionId: props.sessionId,
      playerId: props.playerId || '',
      name: displayName(),
      isHost: props.isHost,
      resumeToken: store.resumeToken || undefined,
    },
    (res) => {
      if (res.ok) {
        store.playerId = res.playerId;
        store.playerName = displayName();
        store.roomCode = res.roomCode;
        store.resumeToken = res.resumeToken;
        store.saveSession();
      } else {
        embeddedError.value = res.error;
      }
    }
  );
}

function retryJoin() {
  embeddedError.value = '';
  if (socket.connected) emitAutoJoinRoom();
  else socket.connect();
}

function handleConnect() {
  emitAutoJoinRoom();
}

function handleConnectError() {
  if (!store.room) embeddedError.value = 'Connection failed. Please retry.';
}

function handleStartGame() {
  socket.emit('startGame', { roomCode: store.roomCode }, (res) => {
    if (!res.ok) embeddedError.value = res.error;
  });
}

function handleSetupChoice(flip: boolean) {
  socket.emit('flipRow', { roomCode: store.roomCode, flip }, (res) => {
    if (!res.ok) embeddedError.value = res.error;
  });
}

function handlePlayCards(payload: { startIndex: number; count: number }) {
  socket.emit('playCards', { roomCode: store.roomCode, ...payload }, (res) => {
    if (!res.ok) embeddedError.value = res.error;
  });
}

function handleScout(payload: {
  source: 'showPile' | 'table';
  side: 'left' | 'right';
  cardId?: string;
  fromPlayerId?: string;
}) {
  socket.emit('pass', { roomCode: store.roomCode, ...payload }, (res) => {
    if (!res.ok) embeddedError.value = res.error;
  });
}

function handlePlayAgain() {
  socket.emit('playAgain', { roomCode: store.roomCode }, (res) => {
    if (!res.ok) embeddedError.value = res.error;
  });
}

onMounted(() => {
  const { socket: s } = useSocket({
    apiBaseUrl: props.apiBaseUrl,
    sessionId: props.sessionId,
    playerId: props.playerId,
    wsNamespace: props.wsNamespace,
  });
  socket = s;
  socket.on('roomUpdate', commitRoomUpdate);
  socket.on('connect', handleConnect);
  socket.on('connect_error', handleConnectError);

  if (!props.sessionId) {
    embeddedError.value = 'Missing session info.';
    return;
  }

  const saved = store.loadSession();
  if (saved) {
    store.playerId = saved.playerId;
    store.playerName = saved.name;
    store.roomCode = saved.roomCode;
    store.resumeToken = saved.resumeToken;
  }

  if (socket.connected) emitAutoJoinRoom();
  else socket.connect();

  retryTimer = window.setTimeout(() => {
    if (!store.room) embeddedError.value = 'Unable to join the game. Please retry.';
  }, 3000);
});

onBeforeUnmount(() => {
  clearRetryTimer();
  if (phaseChangeTimer) clearTimeout(phaseChangeTimer);
  socket?.off('roomUpdate', commitRoomUpdate);
  socket?.off('connect', handleConnect);
  socket?.off('connect_error', handleConnectError);
  socket?.disconnect();
});
</script>

<template>
  <div class="min-h-dvh bg-canvas">
    <template v-if="!store.room">
      <div class="flex min-h-dvh items-center justify-center">
        <div class="text-center">
          <p class="text-muted">{{ embeddedError || 'Connecting…' }}</p>
          <button
            v-if="embeddedError"
            class="ui-btn-secondary mt-4"
            type="button"
            @click="retryJoin"
          >
            Retry
          </button>
        </div>
      </div>
    </template>

    <Lobby v-else-if="store.phase === 'lobby'" @start-game="handleStartGame" />
    <SetupFlip
      v-else-if="store.phase === 'playing' && !store.setupComplete"
      @choose="handleSetupChoice"
    />
    <GameTable
      v-else-if="store.phase === 'playing'"
      @play-cards="handlePlayCards"
      @scout="handleScout"
    />
    <GameOver v-else-if="store.phase === 'ended'" @play-again="handlePlayAgain" />

    <p
      v-if="embeddedError && store.room"
      class="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-[--radius-md] bg-danger-muted px-6 py-3 text-sm text-danger"
    >
      {{ embeddedError }}
    </p>
  </div>
</template>
