<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { useRouter } from 'vue-router';
import { usePartyStore } from '../stores/party';
import { usePartySocket } from '../composables/usePartySocket';

const router = useRouter();
const store = usePartyStore();
const socket = usePartySocket();

const playerName = ref('');
const inviteCode = ref('');
const error = ref('');
const mode = ref<'create' | 'join'>('create');

function handleCreate() {
  const name = playerName.value.trim();
  if (!name) return;
  error.value = '';

  socket.emit('createParty', { playerName: name }, (res) => {
    if (!res.ok) {
      error.value = res.error;
      return;
    }
    store.setSession({
      playerId: res.playerId,
      playerName: name,
      inviteCode: res.partyView.inviteCode,
      resumeToken: res.resumeToken,
    });
    store.applyPartyUpdate(res.partyView);
    store.saveSession(res.partyView.inviteCode);
    router.push(`/party/${res.partyView.inviteCode}`);
  });
}

function handleJoin() {
  const name = playerName.value.trim();
  const code = inviteCode.value.trim().toUpperCase();
  if (!name || !code) return;
  error.value = '';

  socket.emit('joinParty', { playerName: name, inviteCode: code }, (res) => {
    if (!res.ok) {
      error.value = res.error;
      return;
    }
    store.setSession({
      playerId: res.playerId,
      playerName: name,
      inviteCode: res.partyView.inviteCode,
      resumeToken: res.resumeToken,
    });
    store.applyPartyUpdate(res.partyView);
    store.saveSession(res.partyView.inviteCode);
    router.push(`/party/${res.partyView.inviteCode}`);
  });
}

function tryResume() {
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
        return;
      }
      store.setSession({
        playerId: session.playerId,
        playerName: session.playerName,
        inviteCode: session.inviteCode,
        resumeToken: session.resumeToken,
      });
      store.applyPartyUpdate(res.partyView);

      if (res.partyView.activeMatch) {
        router.push(`/party/${session.inviteCode}/game/${res.partyView.activeMatch.gameId}`);
      } else {
        router.push(`/party/${session.inviteCode}`);
      }
    }
  );
}

onMounted(() => {
  socket.on('partyUpdate', store.applyPartyUpdate);
  socket.on('connect', tryResume);

  if (socket.connected) {
    tryResume();
  } else {
    socket.connect();
  }
});

onBeforeUnmount(() => {
  socket.off('partyUpdate', store.applyPartyUpdate);
  socket.off('connect', tryResume);
});
</script>

<template>
  <div class="mx-auto max-w-[400px] px-4 pt-16">
    <h1 class="mb-8 text-center text-3xl font-extrabold text-accent">Game Platform</h1>

    <div class="mb-6 flex gap-2">
      <button
        v-for="tab in (['create', 'join'] as const)"
        :key="tab"
        class="flex-1 cursor-pointer rounded-[--radius-md] border border-border-strong bg-transparent px-4 py-2.5 text-muted transition-all duration-150"
        :class="mode === tab && 'border-accent bg-shell text-foreground'"
        @click="mode = tab"
      >
        {{ tab === 'create' ? 'Create Party' : 'Join Party' }}
      </button>
    </div>

    <form class="flex flex-col gap-4" @submit.prevent="mode === 'create' ? handleCreate() : handleJoin()">
      <div class="flex flex-col gap-1.5">
        <label for="name" class="text-sm text-muted">Your Name</label>
        <input
          id="name"
          v-model="playerName"
          class="ui-input"
          type="text"
          placeholder="Enter your name"
          maxlength="20"
          autocomplete="off"
        />
      </div>

      <div v-if="mode === 'join'" class="flex flex-col gap-1.5">
        <label for="code" class="text-sm text-muted">Invite Code</label>
        <input
          id="code"
          v-model="inviteCode"
          class="ui-input uppercase"
          type="text"
          placeholder="e.g. ABC123"
          maxlength="6"
          autocomplete="off"
        />
      </div>

      <p v-if="error" class="text-sm text-danger">{{ error }}</p>

      <button type="submit" class="ui-btn-primary">
        {{ mode === 'create' ? 'Create Party' : 'Join Party' }}
      </button>
    </form>
  </div>
</template>
