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
    store.setSession({ playerId: res.playerId, playerName: name, inviteCode: res.partyView.inviteCode });
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
    store.setSession({ playerId: res.playerId, playerName: name, inviteCode: res.partyView.inviteCode });
    store.applyPartyUpdate(res.partyView);
    store.saveSession(res.partyView.inviteCode);
    router.push(`/party/${res.partyView.inviteCode}`);
  });
}

function tryResume() {
  const session = store.loadSession();
  if (!session) return;

  socket.emit('resumeParty', { inviteCode: session.inviteCode, playerId: session.playerId }, (res) => {
    if (!res.ok) {
      store.clearSession();
      return;
    }
    store.setSession({ playerId: session.playerId, playerName: session.playerName, inviteCode: session.inviteCode });
    store.applyPartyUpdate(res.partyView);

    if (res.partyView.activeMatch) {
      router.push(`/party/${session.inviteCode}/game/${res.partyView.activeMatch.gameId}`);
    } else {
      router.push(`/party/${session.inviteCode}`);
    }
  });
}

onMounted(() => {
  socket.on('partyUpdate', store.applyPartyUpdate);

  if (socket.connected) {
    tryResume();
  } else {
    socket.once('connect', tryResume);
    socket.connect();
  }
});

onBeforeUnmount(() => {
  socket.off('partyUpdate', store.applyPartyUpdate);
});
</script>

<template>
  <div class="home">
    <h1 class="title">Game Platform</h1>

    <div class="tabs">
      <button :class="['tab', { active: mode === 'create' }]" @click="mode = 'create'">
        Create Party
      </button>
      <button :class="['tab', { active: mode === 'join' }]" @click="mode = 'join'">
        Join Party
      </button>
    </div>

    <form class="form" @submit.prevent="mode === 'create' ? handleCreate() : handleJoin()">
      <div class="field">
        <label for="name">Your Name</label>
        <input
          id="name"
          v-model="playerName"
          type="text"
          placeholder="Enter your name"
          maxlength="20"
          autocomplete="off"
        />
      </div>

      <div v-if="mode === 'join'" class="field">
        <label for="code">Invite Code</label>
        <input
          id="code"
          v-model="inviteCode"
          type="text"
          placeholder="e.g. ABC123"
          maxlength="6"
          autocomplete="off"
          style="text-transform: uppercase"
        />
      </div>

      <p v-if="error" class="error">{{ error }}</p>

      <button type="submit" class="btn-primary">
        {{ mode === 'create' ? 'Create Party' : 'Join Party' }}
      </button>
    </form>
  </div>
</template>

<style scoped>
.home {
  max-width: 400px;
  margin: 4rem auto;
  padding: 0 1rem;
}

.title {
  font-size: 2rem;
  font-weight: 800;
  text-align: center;
  margin-bottom: 2rem;
  color: #f97316;
}

.tabs {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
}

.tab {
  flex: 1;
  padding: 0.65rem 1rem;
  border: 1px solid #3f3f46;
  border-radius: 8px;
  background: transparent;
  color: #a1a1aa;
  font: inherit;
  cursor: pointer;
  transition: all 0.15s ease;
}

.tab.active {
  background: #1c1c22;
  border-color: #f97316;
  color: #fafafa;
}

.form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

label {
  font-size: 0.85rem;
  color: #a1a1aa;
}

input {
  padding: 0.65rem 0.9rem;
  border: 1px solid #3f3f46;
  border-radius: 8px;
  background: #18181b;
  color: #fafafa;
  font: inherit;
  font-size: 1rem;
  outline: none;
}

input:focus {
  border-color: #f97316;
}

.error {
  color: #f87171;
  font-size: 0.875rem;
}

.btn-primary {
  padding: 0.75rem 1rem;
  border: none;
  border-radius: 8px;
  background: #f97316;
  color: #fff;
  font: inherit;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s ease;
}

.btn-primary:hover {
  opacity: 0.9;
}
</style>
