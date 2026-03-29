<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
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

const store = useGameStore();
const { socket } = useSocket({
  apiBaseUrl: props.apiBaseUrl,
  sessionId: props.sessionId,
  playerId: props.playerId,
  wsNamespace: props.wsNamespace,
});

const embeddedError = ref('');
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
  if (!store.roomCode || !store.playerId) return;
  socket.emit('startGame', { roomCode: store.roomCode, playerId: store.playerId }, () => {});
}

function handleAssignTeam(team: TeamColor) {
  if (!store.roomCode || !store.playerId) return;
  socket.emit('assignTeam', { roomCode: store.roomCode, playerId: store.playerId, team }, () => {});
}

function handleAssignRole(role: PlayerRole) {
  if (!store.roomCode || !store.playerId) return;
  socket.emit('assignRole', { roomCode: store.roomCode, playerId: store.playerId, role }, () => {});
}

function handleSetTeamCount(count: number) {
  if (!store.roomCode || !store.playerId) return;
  socket.emit(
    'setTeamCount',
    { roomCode: store.roomCode, playerId: store.playerId, teamCount: count },
    () => {}
  );
}

function handleSetAssassinPenaltyMode(mode: AssassinPenaltyMode) {
  if (!store.roomCode || !store.playerId) return;
  socket.emit(
    'setAssassinPenaltyMode',
    { roomCode: store.roomCode, playerId: store.playerId, mode },
    () => {}
  );
}

function handleFocusCard(cardIndex: number | null) {
  if (!store.roomCode || !store.playerId) return;
  socket.emit(
    'focusCard',
    { roomCode: store.roomCode, playerId: store.playerId, cardIndex },
    () => {}
  );
}

function handleGiveSignal(word: string, number: number) {
  if (!store.roomCode || !store.playerId) return;
  socket.emit(
    'giveSignal',
    { roomCode: store.roomCode, playerId: store.playerId, word, number },
    () => {}
  );
}

function handleRevealCard(cardIndex: number) {
  if (!store.roomCode || !store.playerId) return;
  socket.emit(
    'revealCard',
    { roomCode: store.roomCode, playerId: store.playerId, cardIndex },
    () => {}
  );
}

function handleEndTurn() {
  if (!store.roomCode || !store.playerId) return;
  socket.emit('endTurn', { roomCode: store.roomCode, playerId: store.playerId }, () => {});
}

function handleSkipGuessRound() {
  if (!store.roomCode || !store.playerId) return;
  socket.emit('skipGuessRound', { roomCode: store.roomCode, playerId: store.playerId }, () => {});
}

function handleRestart() {
  if (!store.roomCode || !store.playerId) return;
  socket.emit('restartGame', { roomCode: store.roomCode, playerId: store.playerId }, () => {});
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
  socket.on('connect', handleSocketConnect);

  if (props.sessionId) {
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
          embeddedError.value =
            'Unable to join the game. Please return to the party and try again.';
          return;
        }
        emitAutoJoinRoom();
      }
    }, 3000);
    return;
  }
});

onBeforeUnmount(() => {
  if (autoJoinRetryTimer !== undefined) {
    clearTimeout(autoJoinRetryTimer);
  }
  socket.off('roomState', handleRoomState);
  socket.off('connect', handleSocketConnect);
});
</script>

<template>
  <div class="min-h-dvh">
    <template v-if="!store.room">
      <p class="py-8 px-4 text-center text-muted">{{ embeddedError || 'Connecting...' }}</p>
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
      @focus-card="handleFocusCard"
      @give-signal="handleGiveSignal"
      @reveal-card="handleRevealCard"
      @end-turn="handleEndTurn"
      @skip-guess-round="handleSkipGuessRound"
    />
    <GameOver v-else-if="store.phase === 'ended'" @restart="handleRestart" />
  </div>
</template>
