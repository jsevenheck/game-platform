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
  <div class="home-root">
    <div class="home-card">
      <!-- Top accent line -->
      <div class="home-top-line" />

      <!-- Hero -->
      <div class="home-hero">
        <div class="home-logo-wrap">
          <span class="home-logo-icon">⚡</span>
        </div>
        <h1 class="home-title">Game Platform</h1>
        <p class="home-sub">Create a party or join your friends</p>
      </div>

      <!-- Tab switcher -->
      <div class="ui-tab-group mb-6">
        <button
          v-for="tab in ['create', 'join'] as const"
          :key="tab"
          class="ui-tab"
          :class="{ 'ui-tab-active': mode === tab }"
          @click="mode = tab"
        >
          {{ tab === 'create' ? 'Create Party' : 'Join Party' }}
        </button>
      </div>

      <!-- Form -->
      <form
        class="flex flex-col gap-4"
        @submit.prevent="mode === 'create' ? handleCreate() : handleJoin()"
      >
        <div class="flex flex-col gap-1.5">
          <label for="name" class="home-label">Your Name</label>
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

        <Transition name="slide-up">
          <div v-if="mode === 'join'" class="flex flex-col gap-1.5">
            <label for="code" class="home-label">Invite Code</label>
            <input
              id="code"
              v-model="inviteCode"
              class="ui-input home-code-input uppercase"
              type="text"
              placeholder="ABC123"
              maxlength="6"
              autocomplete="off"
            />
          </div>
        </Transition>

        <Transition name="fade">
          <p v-if="error" class="home-error">{{ error }}</p>
        </Transition>

        <button type="submit" class="ui-btn-primary home-submit">
          {{ mode === 'create' ? 'Create Party' : 'Join Party' }}
        </button>
      </form>
    </div>
  </div>
</template>

<style scoped>
.home-root {
  min-height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
}

.home-card {
  width: 100%;
  max-width: 400px;
  background: var(--color-panel);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-xl);
  padding: 2.5rem 2rem;
  box-shadow:
    0 24px 64px rgba(0, 0, 0, 0.65),
    0 0 0 1px rgba(255, 255, 255, 0.03) inset;
  position: relative;
  overflow: hidden;
}

.home-top-line {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(249, 115, 22, 0.4), transparent);
}

.home-hero {
  text-align: center;
  margin-bottom: 2rem;
}

.home-logo-wrap {
  width: 56px;
  height: 56px;
  margin: 0 auto 1.125rem;
  background: var(--color-elevated);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-lg);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.625rem;
  box-shadow: 0 0 24px rgba(249, 115, 22, 0.18);
}

.home-logo-icon {
  line-height: 1;
}

.home-title {
  font-size: 1.875rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  background: linear-gradient(135deg, #f0f0f5 0%, #7878a0 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin-bottom: 0.375rem;
  line-height: 1.2;
}

.home-sub {
  font-size: 0.875rem;
  color: var(--color-muted-foreground);
  font-weight: 400;
}

.home-label {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--color-muted);
  letter-spacing: 0.02em;
}

.home-code-input {
  text-align: center;
  letter-spacing: 0.2em;
  font-family: 'JetBrains Mono', monospace;
  font-size: 1.125rem;
}

.home-error {
  font-size: 0.875rem;
  color: var(--color-danger);
  background: var(--color-danger-muted);
  border: 1px solid rgba(239, 68, 68, 0.2);
  border-radius: var(--radius-md);
  padding: 0.5rem 0.75rem;
}

.home-submit {
  width: 100%;
  font-size: 1rem;
  margin-top: 0.25rem;
  padding: 0.875rem 1.5rem;
}
</style>
