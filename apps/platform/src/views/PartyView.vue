<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { useRouter } from 'vue-router';
import { usePartyStore } from '../stores/party';
import { usePartySocket } from '../composables/usePartySocket';
import { clientGameRegistry } from '../games/index';

const props = defineProps<{ inviteCode: string }>();
const router = useRouter();
const store = usePartyStore();
const socket = usePartySocket();

const error = ref('');
const launching = ref(false);

function handleSelectGame(gameId: string) {
  if (!store.isHost || !store.playerId) return;
  socket.emit('selectGame', { playerId: store.playerId, gameId }, (res) => {
    if (!res.ok) error.value = res.error;
  });
}

function handleLaunch() {
  if (!store.isHost || !store.playerId) return;
  launching.value = true;
  socket.emit('launchGame', { playerId: store.playerId }, (res) => {
    launching.value = false;
    if (!res.ok) error.value = res.error;
  });
}

function handleLeave() {
  if (!store.playerId) return;
  socket.emit('leaveParty', { playerId: store.playerId });
  store.clearSession();
  router.push('/');
}

function handlePartyUpdate(view: Parameters<typeof store.applyPartyUpdate>[0]) {
  store.applyPartyUpdate(view);

  // Navigate to game when match starts
  if (view.status === 'in-match' && view.activeMatch) {
    router.push(`/party/${props.inviteCode}/game/${view.activeMatch.gameId}`);
  }
}

// Hoisted so it can be registered for reconnects as well as initial mount.
// Reads the session fresh each time — safe to call repeatedly.
function doResume() {
  const session = store.loadSession();
  if (!session || session.inviteCode !== props.inviteCode) {
    router.push('/');
    return;
  }
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

onMounted(() => {
  socket.on('partyUpdate', handlePartyUpdate);
  // Re-bind to party on every reconnect (network drop → new socket ID on server)
  socket.on('connect', doResume);

  // If we already have party state (arrived via redirect), no initial resume needed
  if (store.party?.inviteCode === props.inviteCode) return;

  // Otherwise resume from session
  if (socket.connected) {
    doResume();
  } else {
    socket.connect();
  }
});

onBeforeUnmount(() => {
  socket.off('partyUpdate', handlePartyUpdate);
  socket.off('connect', doResume);
});
</script>

<template>
  <div class="min-h-dvh">
    <header class="ui-shell-header">
      <div class="flex flex-col">
        <span class="text-[0.7rem] uppercase tracking-widest text-muted-foreground"
          >Party Code</span
        >
        <span class="code text-lg font-extrabold tracking-[0.2em] text-accent">{{
          store.party?.inviteCode ?? inviteCode
        }}</span>
      </div>
      <button
        class="ui-btn-ghost rounded-pill border border-border-strong px-4 py-1.5 text-sm"
        @click="handleLeave"
      >
        Leave
      </button>
    </header>

    <div
      v-if="store.connectionLost"
      class="bg-warning-muted text-warning border-b border-warning px-4 py-2 text-center text-sm font-medium"
    >
      Connection lost — reconnecting...
    </div>

    <main class="mx-auto flex max-w-140 flex-col gap-8 p-4 pt-6">
      <section>
        <h2 class="ui-section-label">Players ({{ store.connectedMembers.length }})</h2>
        <ul class="flex flex-col gap-1.5">
          <li
            v-for="member in store.party?.members ?? []"
            :key="member.playerId"
            class="flex items-center gap-2 rounded-[--radius-md] border border-border bg-panel px-3 py-2.5"
            :class="{ 'opacity-50': !member.connected }"
          >
            <span class="flex-1 font-medium">{{ member.name }}</span>
            <span
              v-if="member.playerId === store.party?.hostPlayerId"
              class="ui-badge bg-blackout text-white"
              >HOST</span
            >
            <span v-if="!member.connected" class="text-[0.7rem] text-muted-foreground">away</span>
          </li>
        </ul>
      </section>

      <section v-if="store.isHost">
        <h2 class="ui-section-label">Select a Game</h2>
        <div class="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3">
          <button
            v-for="game in clientGameRegistry"
            :key="game.definition.id"
            class="flex cursor-pointer flex-col gap-1 rounded-[--radius-md] border border-border-strong bg-panel p-4 text-left transition-all duration-150"
            :class="
              store.party?.selectedGameId === game.definition.id
                ? 'border-accent! bg-accent-muted!'
                : 'hover:border-accent'
            "
            @click="handleSelectGame(game.definition.id)"
          >
            <span class="text-base font-bold">{{ game.definition.name }}</span>
            <span class="text-xs text-muted-foreground"
              >{{ game.definition.minPlayers }}–{{ game.definition.maxPlayers }} players</span
            >
          </button>
        </div>
      </section>

      <section v-else-if="store.party?.selectedGameId" class="text-center text-muted">
        <p class="mb-2 text-base">
          Game selected:
          <strong class="text-foreground">{{
            clientGameRegistry.find((g) => g.definition.id === store.party?.selectedGameId)
              ?.definition.name
          }}</strong>
        </p>
        <p class="text-sm text-muted-foreground">Waiting for host to launch...</p>
      </section>

      <p v-if="error" class="text-sm text-danger">{{ error }}</p>

      <button
        v-if="store.isHost"
        class="ui-btn-primary text-lg"
        :disabled="!store.party?.selectedGameId || launching"
        @click="handleLaunch"
      >
        {{ launching ? 'Launching...' : 'Launch Game' }}
      </button>
    </main>
  </div>
</template>
