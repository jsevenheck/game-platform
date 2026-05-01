<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, shallowRef } from 'vue';
import { useRouter } from 'vue-router';
import { usePartyStore } from '../stores/party';
import { usePartySocket } from '../composables/usePartySocket';
import { getClientGame } from '../games/index';
import type { Component } from 'vue';

const props = defineProps<{ inviteCode: string; gameId: string }>();
const router = useRouter();
const store = usePartyStore();
const socket = usePartySocket();

const gameComponent = shallowRef<Component | null>(null);
const loadError = ref('');
const actionError = ref('');
const showLeaveConfirm = ref(false);

// The matchKey drives which match instance is rendered.
// When it changes, Vue re-mounts the game adapter with the new match.
const matchKey = computed(() => store.party?.activeMatch?.matchKey ?? null);
const namespace = computed(() => store.party?.activeMatch?.namespace ?? `/g/${props.gameId}`);

// Platform callbacks passed down to the game adapter
function onReplayGame(): void {
  if (!store.playerId) return;
  actionError.value = '';
  socket.emit('replayGame', { playerId: store.playerId }, (res) => {
    if (!res.ok) {
      actionError.value = res.error ?? 'Replay failed';
      console.error('[GameView] replayGame failed:', res.error);
    }
  });
}

function onReturnToLobby(): void {
  if (!store.playerId) return;
  actionError.value = '';
  socket.emit('returnToLobby', { playerId: store.playerId }, (res) => {
    if (!res.ok) {
      actionError.value = res.error ?? 'Return to lobby failed';
      console.error('[GameView] returnToLobby failed:', res.error);
    }
  });
}

function onLeaveGame(): void {
  router.push(`/party/${props.inviteCode}`);
}

function handlePartyUpdate(view: Parameters<typeof store.applyPartyUpdate>[0]) {
  store.applyPartyUpdate(view);

  // Server told us to return to lobby
  if (view.status === 'returning' || view.status === 'lobby') {
    if (store.playerId) {
      socket.emit('ackReturnedToLobby', { playerId: store.playerId });
    }
    router.push(`/party/${props.inviteCode}`);
  }
}

async function loadGameComponent(retries = 2): Promise<void> {
  const game = getClientGame(props.gameId);
  if (!game) {
    loadError.value = `Unknown game: ${props.gameId}`;
    return;
  }

  let lastError: unknown;
  for (let i = 0; i <= retries; i++) {
    try {
      const mod = await game.loadClient();
      gameComponent.value = mod.default;
      loadError.value = '';
      return;
    } catch (e) {
      lastError = e;
      console.warn(`[GameView] load attempt ${i + 1} failed:`, e);
      if (i < retries) {
        await new Promise((r) => setTimeout(r, 500 * (i + 1)));
      }
    }
  }

  loadError.value = `Failed to load game: ${String(lastError)}`;
}

// Lightweight re-bind used on every reconnect after the component is mounted.
// Does not await or resolve a Promise — fire-and-forget re-registration.
function resumePartyBinding() {
  const session = store.loadSession();
  if (!session) return;
  socket.emit(
    'resumeParty',
    {
      inviteCode: session.inviteCode,
      playerId: session.playerId,
      resumeToken: session.resumeToken,
    },
    (res) => {
      if (!res.ok) {
        store.clearSession();
        router.push('/');
        return;
      }
      store.setSession({
        playerId: session.playerId,
        playerName: session.playerName,
        inviteCode: session.inviteCode,
        resumeToken: session.resumeToken,
      });
      store.applyPartyUpdate(res.partyView);
    }
  );
}

onMounted(async () => {
  socket.on('partyUpdate', handlePartyUpdate);

  // Resume party state if needed (initial load / hard reload)
  if (!store.party) {
    const session = store.loadSession();
    if (!session) {
      router.push('/');
      return;
    }

    await new Promise<void>((resolve) => {
      const doResume = () => {
        socket.emit(
          'resumeParty',
          {
            inviteCode: session.inviteCode,
            playerId: session.playerId,
            resumeToken: session.resumeToken,
          },
          (res) => {
            if (!res.ok) {
              store.clearSession();
              router.push('/');
              return;
            }
            store.setSession({
              playerId: session.playerId,
              playerName: session.playerName,
              inviteCode: session.inviteCode,
              resumeToken: session.resumeToken,
            });
            store.applyPartyUpdate(res.partyView);
            resolve();
          }
        );
      };

      if (socket.connected) {
        doResume();
      } else {
        socket.once('connect', doResume);
        socket.connect();
      }
    });
  }

  // Register reconnect handler after initial setup — avoids double-firing
  // on the first connect event alongside the socket.once above.
  socket.on('connect', resumePartyBinding);

  // If after resume there's no active match, go back to party lobby
  if (!store.party?.activeMatch) {
    router.push(`/party/${props.inviteCode}`);
    return;
  }

  await loadGameComponent();
});

onBeforeUnmount(() => {
  socket.off('partyUpdate', handlePartyUpdate);
  socket.off('connect', resumePartyBinding);
});
</script>

<template>
  <div class="min-h-dvh">
    <!-- Leave button via Teleport to body so it's always above everything -->
    <Teleport to="body">
      <div class="fixed top-3 left-3 z-[100]">
        <button class="game-leave-btn" @click="showLeaveConfirm = true">
          <span class="game-leave-arrow">←</span> Leave
        </button>
      </div>
    </Teleport>

    <!-- Leave confirmation dialog -->
    <Transition name="fade">
      <div v-if="showLeaveConfirm" class="ui-overlay !z-[200]">
        <div class="ui-dialog">
          <div class="game-dialog-icon">🚪</div>
          <h2 class="game-dialog-title">Leave Game?</h2>
          <p class="game-dialog-desc">You can rejoin from the party lobby at any time.</p>
          <div class="flex flex-col gap-3">
            <button class="ui-btn-danger" @click="onLeaveGame">Leave Game</button>
            <button class="ui-btn-secondary" @click="showLeaveConfirm = false">Stay</button>
          </div>
        </div>
      </div>
    </Transition>

    <div v-if="loadError" class="game-state-screen">
      <span class="game-state-icon">⚠️</span>
      <p class="game-state-title">Failed to Load</p>
      <p class="game-state-msg">{{ loadError }}</p>
    </div>

    <div v-else-if="!gameComponent || !matchKey" class="game-state-screen">
      <span class="game-state-icon game-state-spin">⚙️</span>
      <p class="game-state-title">Loading game…</p>
      <p class="game-state-msg">Please wait a moment</p>
    </div>

    <!-- key on matchKey forces full re-mount when the match changes (replay) -->
    <component
      :is="gameComponent"
      v-else
      :key="matchKey"
      :match-key="matchKey"
      :player-id="store.playerId ?? ''"
      :player-name="store.playerName ?? ''"
      :namespace="namespace"
      :is-host="store.isHost"
      :on-replay-game="onReplayGame"
      :on-return-to-lobby="onReturnToLobby"
      :action-error="actionError"
    />
  </div>
</template>

<style scoped>
.game-leave-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.4rem 0.875rem;
  background: rgba(12, 12, 20, 0.9);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-pill);
  color: var(--color-muted);
  font: inherit;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  transition: all 200ms ease;
}

.game-leave-btn:hover {
  color: var(--color-foreground);
  border-color: rgba(255, 255, 255, 0.15);
  background: rgba(20, 20, 32, 0.95);
}

.game-leave-arrow {
  font-size: 0.875rem;
  line-height: 1;
}

/* Dialog */
.game-dialog-icon {
  font-size: 2rem;
  margin-bottom: 0.75rem;
  line-height: 1;
}

.game-dialog-title {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--color-foreground);
  margin-bottom: 0.5rem;
  letter-spacing: -0.01em;
}

.game-dialog-desc {
  font-size: 0.875rem;
  color: var(--color-muted-foreground);
  margin-bottom: 1.75rem;
  line-height: 1.5;
}

/* Loading / error state */
.game-state-screen {
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 2rem;
}

.game-state-icon {
  font-size: 2.5rem;
  margin-bottom: 0.5rem;
  line-height: 1;
}

.game-state-spin {
  display: inline-block;
  animation: spin 2s linear infinite;
}

.game-state-title {
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--color-foreground);
}

.game-state-msg {
  font-size: 0.875rem;
  color: var(--color-muted-foreground);
  text-align: center;
  max-width: 320px;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
