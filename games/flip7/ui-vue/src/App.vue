<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue';
import { useGameStore } from './stores/game';
import { useSocket, type Flip7Socket } from './composables/useSocket';
import type { HubIntegrationProps } from './types/config';
import type { RoomView, RoundPlayerView, PendingActionView } from '@shared/types';
import type { DrawnCardInfo, ActionAnnouncement } from './stores/game';
import type { ActionResolvedEvent } from '@shared/events';
import Lobby from './components/Lobby.vue';
import GameTable from './components/GameTable.vue';
import RoundSummary from './components/RoundSummary.vue';
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
let socket: Flip7Socket;
let retryTimer: number | undefined;
let autoJoinRetryCount = 0;
const MAX_AUTO_JOIN_RETRIES = 3;

const displayName = () => props.playerName || props.playerId || 'Player';

function clearRetryTimer() {
  if (retryTimer !== undefined) {
    clearTimeout(retryTimer);
    retryTimer = undefined;
  }
}

function detectDrawnCard(
  old: RoundPlayerView,
  next: RoundPlayerView,
  oldPending: PendingActionView | null | undefined,
  newPending: PendingActionView | null | undefined,
  myPlayerId: string
): DrawnCardInfo | null {
  // Action card: a new pendingAction appeared addressed to me
  if (!oldPending && newPending?.drawerId === myPlayerId) {
    return { kind: 'action', action: newPending.action };
  }
  // Number card: a value appeared that wasn't in the old array
  const oldNumbers = new Set(old.numberCards);
  for (const v of next.numberCards) {
    if (!oldNumbers.has(v)) return { kind: 'number', value: v };
  }
  // Modifier +N: array grew
  if (next.modifierAdds.length > old.modifierAdds.length) {
    const bonus = next.modifierAdds[next.modifierAdds.length - 1];
    return { kind: 'modifierAdd', bonus };
  }
  // Modifier ×2
  if (!old.hasX2 && next.hasX2) return { kind: 'modifierX2' };
  return null;
}

function handleRoomUpdate(room: RoomView) {
  const oldMyPlayer = store.myRoundPlayer;
  const oldPending = store.currentRound?.pendingAction ?? null;
  store.setRoom(room);
  const newMyPlayer = store.myRoundPlayer;
  const newPending = store.currentRound?.pendingAction ?? null;
  if (store.playerId && oldMyPlayer && newMyPlayer) {
    const drawn = detectDrawnCard(oldMyPlayer, newMyPlayer, oldPending, newPending, store.playerId);
    if (drawn) store.setDrawnCard(drawn);
  }
  embeddedError.value = '';
  autoJoinRetryCount = 0;
  clearRetryTimer();
  emit('phase-change', room.phase);
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
  if (socket.connected) {
    emitAutoJoinRoom();
  } else {
    socket.connect();
  }
}

function handleActionResolved(data: ActionResolvedEvent) {
  const players = store.room?.players ?? [];
  const drawerName = players.find((p) => p.id === data.drawerId)?.name ?? '?';
  const targetName = players.find((p) => p.id === data.targetId)?.name ?? '?';
  const ann: ActionAnnouncement = {
    drawerName,
    action: data.action,
    targetName,
    isSelf: data.drawerId === data.targetId,
  };
  store.setActionAnnouncement(ann);
}

function handleConnect() {
  emitAutoJoinRoom();
}

function handleConnectError() {
  if (!store.room) {
    embeddedError.value = 'Connection failed. Please retry.';
  }
}

// ── Game actions ──────────────────────────────────────────────────────────────

function handleStartGame() {
  socket.emit('startGame', { roomCode: store.roomCode }, (res) => {
    if (!res.ok) embeddedError.value = res.error;
  });
}

function handleSetTargetScore(targetScore: number) {
  socket.emit('setTargetScore', { roomCode: store.roomCode, targetScore });
}

function handleHit() {
  socket.emit('hit', { roomCode: store.roomCode });
}

function handleStay() {
  socket.emit('stay', { roomCode: store.roomCode });
}

function handleChooseTarget(targetPlayerId: string) {
  socket.emit('chooseActionTarget', { roomCode: store.roomCode, targetPlayerId });
}

function handlePlayAgain() {
  socket.emit('playAgain', { roomCode: store.roomCode });
}

// ─────────────────────────────────────────────────────────────────────────────

onMounted(() => {
  const { socket: s } = useSocket({
    apiBaseUrl: props.apiBaseUrl,
    sessionId: props.sessionId,
    playerId: props.playerId,
    wsNamespace: props.wsNamespace,
  });
  socket = s;
  socket.on('roomUpdate', handleRoomUpdate);
  socket.on('actionResolved', handleActionResolved);
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

  if (socket.connected) {
    emitAutoJoinRoom();
  } else {
    socket.connect();
  }

  retryTimer = window.setTimeout(() => {
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
  clearRetryTimer();
  socket?.off('roomUpdate', handleRoomUpdate);
  socket?.off('actionResolved', handleActionResolved);
  socket?.off('connect', handleConnect);
  socket?.off('connect_error', handleConnectError);
});
</script>

<template>
  <div class="min-h-dvh bg-canvas">
    <!-- Loading / error state -->
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

    <!-- Lobby -->
    <Lobby
      v-else-if="store.phase === 'lobby'"
      @start-game="handleStartGame"
      @set-target-score="handleSetTargetScore"
    />

    <!-- Active game -->
    <GameTable
      v-else-if="store.phase === 'playing'"
      @hit="handleHit"
      @stay="handleStay"
      @choose-target="handleChooseTarget"
    />

    <!-- Round summary -->
    <RoundSummary v-else-if="store.phase === 'roundEnd'" />

    <!-- Game over -->
    <GameOver v-else-if="store.phase === 'ended'" @play-again="handlePlayAgain" />

    <!-- Inline error toast -->
    <p
      v-if="embeddedError && store.room"
      class="fixed bottom-4 left-1/2 -translate-x-1/2 rounded-[--radius-md] bg-danger-muted px-6 py-3 text-sm text-danger"
    >
      {{ embeddedError }}
    </p>
  </div>
</template>
