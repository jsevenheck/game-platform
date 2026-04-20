<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue';
import { useGameStore } from './stores/game';
import { useSocket, type Flip7Socket } from './composables/useSocket';
import type { HubIntegrationProps } from './types/config';
import type { RoomView, RoundPlayerView, PendingActionView } from '@shared/types';
import type { DrawnCardInfo, ActionAnnouncement } from './stores/game';
import type { ActionResolvedEvent } from '@shared/events';
import type { Card } from '@shared/deck';
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
// Timer used to delay a room-state update while a dramatic card reveal toast
// is playing (bust / secondChance save). Cleared whenever a newer update arrives.
let dramaticRevealTimer: ReturnType<typeof setTimeout> | null = null;
// Plain snapshot of the previous round – used for draw detection.
// Deliberately NOT a Pinia/Vue reactive reference so Socket.IO callbacks
// always read the correct previous state without reactivity side-effects.
let _lastKnownRound: import('@shared/types').RoundView | null = null;

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
  newPending: PendingActionView | null | undefined
): DrawnCardInfo | null {
  // Action card: a new pendingAction appeared with this player as the drawer
  if (!oldPending && newPending?.drawerId === next.playerId) {
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

/** Convert a server Card to the client DrawnCardInfo union. */
function cardToDrawnCardInfo(card: Card): DrawnCardInfo {
  if (card.kind === 'number') return { kind: 'number', value: card.value };
  if (card.kind === 'modifierAdd') return { kind: 'modifierAdd', bonus: card.bonus };
  if (card.kind === 'modifierX2') return { kind: 'modifierX2' };
  return { kind: 'action', action: card.action };
}

/** Commit a room update to the store and emit phase-change (no draw detection). */
function commitRoomUpdate(room: RoomView) {
  store.setRoom(room);
  embeddedError.value = '';
  autoJoinRetryCount = 0;
  clearRetryTimer();
  emit('phase-change', room.phase);
}

function handleRoomUpdate(room: RoomView) {
  // Cancel any in-flight dramatic reveal delay so stale updates are dropped.
  if (dramaticRevealTimer !== null) {
    clearTimeout(dramaticRevealTimer);
    dramaticRevealTimer = null;
  }

  const myId = store.playerId;
  // Capture previous round from our own plain snapshot (not Pinia state) so
  // the comparison is always against the last-committed round, regardless of
  // Vue reactivity timing.
  const oldRound = _lastKnownRound;
  // Advance snapshot immediately – subsequent updates use this as their baseline.
  _lastKnownRound = room.currentRound;

  const oldPending = oldRound?.pendingAction ?? null;
  const newPending = room.currentRound?.pendingAction ?? null;

  // ── Detect drawn cards for every player (only one draws per turn) ──────────
  for (const newRp of room.currentRound?.players ?? []) {
    const oldRp = oldRound?.players.find((p) => p.playerId === newRp.playerId);
    if (!oldRp) continue;

    const isMe = newRp.playerId === myId;
    // null  → local player toast shows "You drew"
    // string → other player toast shows "<Name> drew"
    const drawerName = isMe
      ? null
      : (room.players.find((p) => p.id === newRp.playerId)?.name ?? null);

    // ── Dramatic events: bust or secondChance save ──────────────────────────
    const wasBusted = oldRp.status === 'active' && newRp.status === 'busted';
    const secondChanceSaved =
      oldRp.hasSecondChance === true &&
      newRp.hasSecondChance === false &&
      newRp.status === 'active';

    if ((wasBusted || secondChanceSaved) && newRp.lastDrawnCard) {
      store.setDrawnCard(cardToDrawnCardInfo(newRp.lastDrawnCard), drawerName);
      if (isMe) {
        // Delay the state update so the local player sees the card before
        // their board status changes to busted / shield consumed.
        dramaticRevealTimer = setTimeout(() => {
          dramaticRevealTimer = null;
          commitRoomUpdate(room);
        }, 2000);
        return; // commitRoomUpdate called by timer
      }
      break; // Show toast for other player, then fall through to commit
    }

    // ── Normal draws (number added, modifier gained, action pending) ─────────
    const drawn = detectDrawnCard(oldRp, newRp, oldPending, newPending);
    if (drawn) {
      store.setDrawnCard(drawn, drawerName);
      break;
    }
  }

  commitRoomUpdate(room);
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
  _lastKnownRound = null;
  if (dramaticRevealTimer !== null) {
    clearTimeout(dramaticRevealTimer);
    dramaticRevealTimer = null;
  }
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
