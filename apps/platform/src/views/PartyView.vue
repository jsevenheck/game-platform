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

onMounted(() => {
  socket.on('partyUpdate', handlePartyUpdate);

  // If we already have party state (arrived via redirect), stay
  if (store.party?.inviteCode === props.inviteCode) return;

  // Otherwise resume from session
  const session = store.loadSession();
  if (!session || session.inviteCode !== props.inviteCode) {
    router.push('/');
    return;
  }

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

onBeforeUnmount(() => {
  socket.off('partyUpdate', handlePartyUpdate);
});
</script>

<template>
  <div class="party-view">
    <header class="header">
      <div class="invite-code">
        <span class="label">Party Code</span>
        <span class="code">{{ store.party?.inviteCode ?? inviteCode }}</span>
      </div>
      <button class="leave-btn" @click="handleLeave">Leave</button>
    </header>

    <main class="main">
      <section class="members-section">
        <h2>Players ({{ store.connectedMembers.length }})</h2>
        <ul class="member-list">
          <li
            v-for="member in store.party?.members ?? []"
            :key="member.playerId"
            :class="['member', { disconnected: !member.connected }]"
          >
            <span class="member-name">{{ member.name }}</span>
            <span v-if="member.playerId === store.party?.hostPlayerId" class="host-badge"
              >HOST</span
            >
            <span v-if="!member.connected" class="dc-badge">away</span>
          </li>
        </ul>
      </section>

      <section v-if="store.isHost" class="game-select">
        <h2>Select a Game</h2>
        <div class="game-grid">
          <button
            v-for="game in clientGameRegistry"
            :key="game.definition.id"
            :class="['game-card', { selected: store.party?.selectedGameId === game.definition.id }]"
            @click="handleSelectGame(game.definition.id)"
          >
            <span class="game-name">{{ game.definition.name }}</span>
            <span class="game-players"
              >{{ game.definition.minPlayers }}–{{ game.definition.maxPlayers }} players</span
            >
          </button>
        </div>
      </section>

      <section v-else-if="store.party?.selectedGameId" class="waiting-game">
        <p class="selected-game">
          Game selected:
          <strong>{{
            clientGameRegistry.find((g) => g.definition.id === store.party?.selectedGameId)
              ?.definition.name
          }}</strong>
        </p>
        <p class="waiting-msg">Waiting for host to launch...</p>
      </section>

      <p v-if="error" class="error">{{ error }}</p>

      <button
        v-if="store.isHost"
        class="launch-btn"
        :disabled="!store.party?.selectedGameId || launching"
        @click="handleLaunch"
      >
        {{ launching ? 'Launching...' : 'Launch Game' }}
      </button>
    </main>
  </div>
</template>

<style scoped>
.party-view {
  min-height: 100dvh;
}

.header {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.85rem 1rem;
  background: rgba(9, 9, 11, 0.92);
  border-bottom: 1px solid #27272a;
  backdrop-filter: blur(12px);
}

.invite-code {
  display: flex;
  flex-direction: column;
}

.label {
  font-size: 0.7rem;
  color: #71717a;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.code {
  font-size: 1.1rem;
  font-weight: 800;
  letter-spacing: 0.2em;
  color: #f97316;
}

.leave-btn {
  border: 1px solid #3f3f46;
  border-radius: 999px;
  background: transparent;
  color: #e4e4e7;
  padding: 0.45rem 0.95rem;
  font: inherit;
  cursor: pointer;
}

.leave-btn:hover {
  border-color: #ef4444;
  color: #fecaca;
}

.main {
  max-width: 560px;
  margin: 0 auto;
  padding: 1.5rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

h2 {
  font-size: 0.85rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: #71717a;
  margin-bottom: 0.75rem;
}

.member-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.member {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.6rem 0.8rem;
  background: #18181b;
  border-radius: 8px;
  border: 1px solid #27272a;
}

.member.disconnected {
  opacity: 0.5;
}

.member-name {
  flex: 1;
  font-weight: 500;
}

.host-badge {
  font-size: 0.7rem;
  font-weight: 700;
  padding: 0.2rem 0.5rem;
  background: #7c3aed;
  border-radius: 999px;
  color: #fff;
}

.dc-badge {
  font-size: 0.7rem;
  color: #71717a;
}

.game-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 0.75rem;
}

.game-card {
  padding: 1rem;
  border: 1px solid #3f3f46;
  border-radius: 10px;
  background: #18181b;
  color: inherit;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  text-align: left;
  transition: all 0.15s ease;
}

.game-card:hover {
  border-color: #f97316;
}

.game-card.selected {
  border-color: #f97316;
  background: #1c1410;
}

.game-name {
  font-weight: 700;
  font-size: 1rem;
}

.game-players {
  font-size: 0.75rem;
  color: #71717a;
}

.waiting-game {
  text-align: center;
  color: #a1a1aa;
}

.selected-game {
  font-size: 1rem;
  margin-bottom: 0.5rem;
}

.selected-game strong {
  color: #fafafa;
}

.waiting-msg {
  font-size: 0.875rem;
  color: #71717a;
}

.error {
  color: #f87171;
  font-size: 0.875rem;
}

.launch-btn {
  padding: 0.85rem 1.5rem;
  border: none;
  border-radius: 10px;
  background: #f97316;
  color: #fff;
  font: inherit;
  font-size: 1rem;
  font-weight: 700;
  cursor: pointer;
  transition: opacity 0.15s ease;
}

.launch-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.launch-btn:not(:disabled):hover {
  opacity: 0.9;
}
</style>
