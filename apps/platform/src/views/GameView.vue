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
    <p v-if="loadError" class="p-8 text-center text-danger">{{ loadError }}</p>

    <p v-else-if="!gameComponent || !matchKey" class="p-8 text-center text-muted-foreground">
      Loading game...
    </p>

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
