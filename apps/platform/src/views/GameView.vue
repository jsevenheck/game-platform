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

// The matchKey drives which match instance is rendered.
// When it changes, Vue re-mounts the game adapter with the new match.
const matchKey = computed(() => store.party?.activeMatch?.matchKey ?? null);
const namespace = computed(() => store.party?.activeMatch?.namespace ?? `/g/${props.gameId}`);

// Platform callbacks passed down to the game adapter
function onReplayGame(): void {
  if (!store.playerId) return;
  socket.emit('replayGame', { playerId: store.playerId }, (res) => {
    if (!res.ok) console.error('[GameView] replayGame failed:', res.error);
  });
}

function onReturnToLobby(): void {
  if (!store.playerId) return;
  socket.emit('returnToLobby', { playerId: store.playerId }, (res) => {
    if (!res.ok) console.error('[GameView] returnToLobby failed:', res.error);
  });
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

async function loadGameComponent(): Promise<void> {
  const game = getClientGame(props.gameId);
  if (!game) {
    loadError.value = `Unknown game: ${props.gameId}`;
    return;
  }
  try {
    const mod = await game.loadClient();
    gameComponent.value = mod.default;
  } catch (e) {
    loadError.value = `Failed to load game: ${String(e)}`;
  }
}

onMounted(async () => {
  socket.on('partyUpdate', handlePartyUpdate);

  // Resume party state if needed
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
          { inviteCode: session.inviteCode, playerId: session.playerId },
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

  // If after resume there's no active match, go back to party lobby
  if (!store.party?.activeMatch) {
    router.push(`/party/${props.inviteCode}`);
    return;
  }

  await loadGameComponent();
});

onBeforeUnmount(() => {
  socket.off('partyUpdate', handlePartyUpdate);
});
</script>

<template>
  <div class="game-view">
    <p v-if="loadError" class="load-error">{{ loadError }}</p>

    <p v-else-if="!gameComponent || !matchKey" class="loading">Loading game...</p>

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
    />
  </div>
</template>

<style scoped>
.game-view {
  min-height: 100dvh;
}

.loading,
.load-error {
  padding: 2rem 1rem;
  text-align: center;
  color: #71717a;
}

.load-error {
  color: #f87171;
}
</style>
