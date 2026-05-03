<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { useRouter } from 'vue-router';
import { usePartyStore } from '../stores/party';
import { usePartySocket } from '../composables/usePartySocket';
import { clientGameRegistry, getClientGame, type PlatformGameMeta } from '../games/index';

const props = defineProps<{ inviteCode: string }>();
const router = useRouter();
const store = usePartyStore();
const socket = usePartySocket();

const error = ref('');
const launching = ref(false);

const gameInProgress = computed(
  () => store.party?.status === 'in-match' && !!store.party?.activeMatch
);
const activeGameName = computed(() => {
  const gameId = store.party?.activeMatch?.gameId;
  return gameId ? (getClientGame(gameId)?.definition.name ?? gameId) : undefined;
});

/* Fallback metadata for games that have not yet defined platform visuals. */
const defaultGameConfig: PlatformGameMeta = {
  icon: '🎮',
  gradFrom: '#1c1c28',
  gradTo: '#111118',
  description: '',
};

function getGameConfig(id: string): PlatformGameMeta {
  return getClientGame(id)?.platformMeta ?? defaultGameConfig;
}

function avatarBg(name: string): string {
  const palette = ['#8b5cf6', '#06b6d4', '#f97316', '#e11d48', '#22c55e', '#f59e0b', '#3b82f6'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return palette[hash % palette.length];
}

function avatarInitials(name: string): string {
  return name.slice(0, 2).toUpperCase();
}

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

function handleEndGame() {
  if (!store.isHost || !store.playerId) return;
  socket.emit('returnToLobby', { playerId: store.playerId }, (res) => {
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
  const wasInMatch = store.party?.status === 'in-match';
  store.applyPartyUpdate(view);

  // Auto-navigate only on fresh launch (lobby/launching → in-match).
  // If the player was already in-match (voluntarily left the game view),
  // don't force them back — they can rejoin via the banner.
  if (!wasInMatch && view.status === 'in-match' && view.activeMatch) {
    router.push(`/party/${props.inviteCode}/game/${view.activeMatch.gameId}`);
  }

  // Players in lobby view won't navigate through GameView, so we ACK here
  // to let the server finalize the lobby transition without waiting 10 s.
  if (view.status === 'returning' && store.playerId) {
    socket.emit('ackReturnedToLobby', { playerId: store.playerId });
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
    <!-- Header -->
    <header class="ui-shell-header">
      <div class="party-code-block">
        <span class="party-code-eyebrow">Party Code</span>
        <span class="party-code-value">{{ store.party?.inviteCode ?? inviteCode }}</span>
      </div>
      <div class="flex items-center gap-3">
        <span class="party-player-count">
          {{ store.connectedMembers.length }}
          <span class="party-player-count-label"> online</span>
        </span>
        <button class="ui-btn-ghost party-leave-btn" @click="handleLeave">Leave</button>
      </div>
    </header>

    <main class="mx-auto flex max-w-140 flex-col gap-8 p-4 pt-6">
      <!-- Rejoin banner when a game is running -->
      <section v-if="gameInProgress" class="party-game-banner">
        <div class="party-game-banner-content">
          <div>
            <p class="party-game-banner-label">Game in progress</p>
            <p class="party-game-banner-title">{{ activeGameName }}</p>
          </div>
          <div class="flex flex-col gap-2 items-end">
            <button
              class="ui-btn-primary"
              @click="
                router.push(`/party/${props.inviteCode}/game/${store.party!.activeMatch!.gameId}`)
              "
            >
              Rejoin Game
            </button>
            <button v-if="store.isHost" class="ui-btn-danger party-end-btn" @click="handleEndGame">
              End Game
            </button>
          </div>
        </div>
      </section>

      <!-- Players section -->
      <section>
        <h2 class="ui-section-label">Players ({{ store.connectedMembers.length }})</h2>
        <ul class="flex flex-col gap-1.5">
          <li
            v-for="member in store.party?.members ?? []"
            :key="member.playerId"
            class="ui-player-item"
            :class="{ 'party-member-away': !member.connected }"
          >
            <div
              class="ui-avatar"
              :style="{
                background: member.connected ? avatarBg(member.name) : 'var(--color-elevated)',
                color: member.connected ? '#fff' : 'var(--color-muted)',
              }"
            >
              {{ avatarInitials(member.name) }}
            </div>
            <span class="flex-1 font-semibold text-sm">{{ member.name }}</span>
            <span
              v-if="member.playerId === store.party?.hostPlayerId"
              class="ui-badge bg-accent text-white"
              >HOST</span
            >
            <span v-if="!member.connected" class="party-away-badge">away</span>
            <span v-else class="party-online-dot" />
          </li>
        </ul>
      </section>

      <!-- Game selection (host) -->
      <section v-if="store.isHost && !gameInProgress">
        <h2 class="ui-section-label">Select a Game</h2>
        <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <button
            v-for="game in clientGameRegistry"
            :key="game.definition.id"
            class="ui-game-card"
            :class="
              store.party?.selectedGameId === game.definition.id ? 'ui-game-card-selected' : ''
            "
            @click="handleSelectGame(game.definition.id)"
          >
            <div
              class="ui-game-card-banner"
              :style="{
                background: `linear-gradient(135deg, ${getGameConfig(game.definition.id).gradFrom} 0%, ${getGameConfig(game.definition.id).gradTo} 100%)`,
              }"
            >
              <span class="relative z-10">{{ getGameConfig(game.definition.id).icon }}</span>
            </div>
            <div class="ui-game-card-body">
              <p class="game-card-name">{{ game.definition.name }}</p>
              <p class="game-card-meta">
                {{ game.definition.minPlayers }}–{{ game.definition.maxPlayers }} players
              </p>
              <p v-if="getGameConfig(game.definition.id).description" class="game-card-desc">
                {{ getGameConfig(game.definition.id).description }}
              </p>
            </div>
          </button>
        </div>
      </section>

      <!-- Game selected view (non-host) -->
      <section v-else-if="!gameInProgress && store.party?.selectedGameId" class="party-waiting">
        <p class="party-waiting-game">
          {{
            clientGameRegistry.find((g) => g.definition.id === store.party?.selectedGameId)
              ?.definition.name
          }}
        </p>
        <p class="party-waiting-label">Waiting for host to launch...</p>
      </section>

      <Transition name="fade">
        <p v-if="error" class="party-error" role="alert" aria-live="polite">{{ error }}</p>
      </Transition>

      <!-- Launch button (host) -->
      <button
        v-if="store.isHost && !gameInProgress"
        class="ui-btn-primary party-launch-btn"
        :disabled="!store.party?.selectedGameId || launching"
        @click="handleLaunch"
      >
        <span v-if="launching" class="party-launching-dot" />
        {{ launching ? 'Launching…' : 'Launch Game' }}
      </button>
    </main>
  </div>
</template>

<style scoped>
/* ── Header ── */
.party-code-block {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.party-code-eyebrow {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.58rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  color: var(--color-muted-foreground);
}

.party-code-value {
  font-family: 'JetBrains Mono', monospace;
  font-size: 1.25rem;
  font-weight: 700;
  letter-spacing: 0.18em;
  color: var(--color-accent);
  text-shadow: 0 0 12px rgba(249, 115, 22, 0.35);
}

.party-player-count {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--color-foreground);
}

.party-player-count-label {
  font-weight: 400;
  color: var(--color-muted-foreground);
}

.party-leave-btn {
  font-size: 0.875rem;
  padding: 0.4rem 1rem;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-pill);
}

/* ── In-progress banner ── */
.party-game-banner {
  border-radius: var(--radius-lg);
  background: var(--color-panel);
  border: 1px solid rgba(249, 115, 22, 0.3);
  box-shadow: 0 0 24px rgba(249, 115, 22, 0.08);
  overflow: hidden;
  position: relative;
}

.party-game-banner::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(90deg, transparent, var(--color-accent), transparent);
}

.party-game-banner-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.25rem 1.5rem;
  gap: 1rem;
}

.party-game-banner-label {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--color-accent);
  margin-bottom: 0.25rem;
}

.party-game-banner-title {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--color-foreground);
}

.party-end-btn {
  font-size: 0.8rem;
  padding: 0.4rem 0.875rem;
}

/* ── Player items ── */
.party-member-away {
  opacity: 0.45;
}

.party-away-badge {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.6rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--color-muted-foreground);
}

.party-online-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--color-success);
  box-shadow: 0 0 6px rgba(34, 197, 94, 0.5);
  flex-shrink: 0;
}

/* ── Game cards ── */
.game-card-name {
  font-size: 0.9375rem;
  font-weight: 700;
  color: var(--color-foreground);
  margin-bottom: 0.15rem;
}

.game-card-meta {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.65rem;
  font-weight: 500;
  color: var(--color-muted-foreground);
  margin-bottom: 0.375rem;
}

.game-card-desc {
  font-size: 0.75rem;
  color: var(--color-muted);
  line-height: 1.35;
}

/* ── Waiting section ── */
.party-waiting {
  text-align: center;
  padding: 1.5rem;
  background: var(--color-panel);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
}

.party-waiting-game {
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--color-foreground);
  margin-bottom: 0.375rem;
}

.party-waiting-label {
  font-size: 0.875rem;
  color: var(--color-muted-foreground);
}

/* ── Error ── */
.party-error {
  font-size: 0.875rem;
  color: var(--color-danger);
  background: var(--color-danger-muted);
  border: 1px solid rgba(239, 68, 68, 0.2);
  border-radius: var(--radius-md);
  padding: 0.5rem 0.75rem;
}

/* ── Launch button ── */
.party-launch-btn {
  width: 100%;
  font-size: 1.0625rem;
  padding: 0.9375rem 1.5rem;
  letter-spacing: 0.01em;
}

.party-launching-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.7);
  animation: pulse 1s ease-in-out infinite;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 0.3;
    transform: scale(0.8);
  }
  50% {
    opacity: 1;
    transform: scale(1);
  }
}
</style>
