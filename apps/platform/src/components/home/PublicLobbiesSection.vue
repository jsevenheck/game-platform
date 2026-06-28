<script setup lang="ts">
import { computed } from 'vue';
import { usePublicLobbies } from '../../composables/usePublicLobbies';
import { usePartyStore } from '../../stores/party';
import PublicLobbiesList from './PublicLobbiesList.vue';

/**
 * Container for the Live Rooms feed. Owns the subscription lifecycle via
 * `usePublicLobbies()`, renders loading/error/empty/ready states, and exposes
 * a manual Refresh button. Re-emits `join-room` to the host view — it never
 * silently joins a party.
 */
const emit = defineEmits<{
  'join-room': [{ inviteCode: string }];
}>();

const { store, refresh } = usePublicLobbies();
const partyStore = usePartyStore();

const currentInviteCode = computed(() => partyStore.party?.inviteCode ?? null);

const isLoading = computed(() => store.state === 'loading' && store.parties.length === 0);
const isReady = computed(
  () => store.state === 'ready' || (store.state === 'loading' && store.parties.length > 0)
);

function handleJoinRoom(payload: { inviteCode: string }): void {
  emit('join-room', payload);
}
</script>

<template>
  <section class="public-lobbies" aria-labelledby="public-lobbies-heading">
    <div class="public-lobbies__header">
      <h2 id="public-lobbies-heading" class="ui-section-label">Live Rooms</h2>
      <button
        type="button"
        class="ui-btn-ghost public-lobbies__refresh"
        :disabled="store.state === 'loading'"
        data-testid="public-lobbies-refresh"
        @click="refresh"
      >
        Refresh
      </button>
    </div>

    <!-- Loading skeleton (first paint, no rooms yet) -->
    <ul
      v-if="isLoading"
      class="public-lobbies-skeleton"
      data-testid="public-lobbies-skeleton"
      aria-busy="true"
      aria-label="Loading live rooms"
    >
      <li v-for="i in 2" :key="i" class="public-lobbies-skeleton__item" />
    </ul>

    <!-- Error (non-destructive: rooms may still be shown above) -->
    <p
      v-else-if="store.state === 'error' && store.parties.length === 0"
      class="public-lobbies__msg public-lobbies__msg--error"
      role="alert"
    >
      {{ store.error ?? 'Could not load live rooms.' }}
    </p>

    <!-- Empty -->
    <p v-else-if="store.isEmpty" class="public-lobbies__msg" data-testid="public-lobbies-empty">
      No public rooms right now. Create a party and list it publicly to let others find it.
    </p>

    <!-- Ready -->
    <PublicLobbiesList
      v-else-if="isReady"
      :parties="store.parties"
      :current-invite-code="currentInviteCode"
      @join-room="handleJoinRoom"
    />

    <!-- Non-destructive error banner alongside existing rooms -->
    <p
      v-if="store.state === 'error' && store.parties.length > 0"
      class="public-lobbies__banner"
      role="status"
    >
      {{ store.error }}
    </p>
  </section>
</template>

<style scoped>
.public-lobbies {
  width: 100%;
}

.public-lobbies__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.875rem;
}

.public-lobbies__refresh {
  font-size: 0.78rem;
  padding: 0.35rem 0.75rem;
}

.public-lobbies__msg {
  font-size: 0.82rem;
  color: var(--color-muted-foreground);
  line-height: 1.5;
  padding: 0.75rem 0.875rem;
  background: var(--color-panel);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}

.public-lobbies__msg--error {
  color: var(--color-danger);
  background: var(--color-danger-muted);
  border-color: rgba(239, 68, 68, 0.2);
}

.public-lobbies__banner {
  margin-top: 0.625rem;
  font-size: 0.72rem;
  color: var(--color-muted);
  font-family: 'JetBrains Mono', monospace;
}

.public-lobbies-skeleton {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.625rem;
}

@media (min-width: 700px) {
  .public-lobbies-skeleton {
    grid-template-columns: repeat(2, 1fr);
  }
}

.public-lobbies-skeleton__item {
  height: 84px;
  border-radius: var(--radius-lg);
  background: linear-gradient(
    100deg,
    var(--color-panel) 30%,
    var(--color-elevated) 50%,
    var(--color-panel) 70%
  );
  background-size: 200% 100%;
  animation: public-lobbies-shimmer 1.4s ease-in-out infinite;
  border: 1px solid var(--color-border);
}

@keyframes public-lobbies-shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .public-lobbies-skeleton__item {
    animation: none;
  }
}
</style>
