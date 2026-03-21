<script setup lang="ts">
/**
 * Platform adapter for Secret Signals.
 *
 * Maps PlatformGameProps → HubIntegrationProps and detects game-end via
 * the `roomState` event (Secret Signals' broadcast event name).
 */
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { io, type Socket } from 'socket.io-client';
import GameApp from './App.vue';

const props = defineProps<{
  matchKey: string;
  playerId: string;
  playerName: string;
  namespace: string;
  isHost?: boolean;
  onReplayGame?: () => void;
  onReturnToLobby?: () => void;
}>();

let monitorSocket: Socket | null = null;
const gamePhase = ref<string | null>(null);
const gameEnded = computed(() => gamePhase.value === 'ended');

function initMonitor() {
  monitorSocket = io(props.namespace, { autoConnect: false });

  monitorSocket.on('roomState', (room: { phase?: string }) => {
    if (room.phase) {
      gamePhase.value = room.phase;
    }
  });

  monitorSocket.connect();
}

onMounted(() => {
  initMonitor();
});

onBeforeUnmount(() => {
  monitorSocket?.disconnect();
  monitorSocket = null;
});
</script>

<template>
  <div class="adapter-wrapper">
    <GameApp
      :player-id="playerId"
      :player-name="playerName"
      :session-id="matchKey"
      :ws-namespace="namespace"
    />

    <Transition name="fade">
      <div v-if="gameEnded && isHost" class="platform-overlay">
        <div class="overlay-card">
          <h2 class="overlay-title">Match Over</h2>
          <p class="overlay-sub">What would you like to do?</p>
          <div class="overlay-actions">
            <button class="btn-replay" @click="onReplayGame?.()">Play Again</button>
            <button class="btn-lobby" @click="onReturnToLobby?.()">Back to Party</button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.adapter-wrapper {
  position: relative;
  min-height: 100dvh;
}

.platform-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: rgba(9, 9, 11, 0.85);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
}

.overlay-card {
  background: #18181b;
  border: 1px solid #3f3f46;
  border-radius: 16px;
  padding: 2.5rem 2rem;
  text-align: center;
  max-width: 320px;
  width: 100%;
}

.overlay-title {
  font-size: 1.5rem;
  font-weight: 800;
  margin-bottom: 0.5rem;
}

.overlay-sub {
  color: #71717a;
  font-size: 0.9rem;
  margin-bottom: 1.5rem;
}

.overlay-actions {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.btn-replay {
  padding: 0.85rem;
  border: none;
  border-radius: 10px;
  background: #f97316;
  color: #fff;
  font: inherit;
  font-size: 1rem;
  font-weight: 700;
  cursor: pointer;
}

.btn-lobby {
  padding: 0.85rem;
  border: 1px solid #3f3f46;
  border-radius: 10px;
  background: transparent;
  color: #e4e4e7;
  font: inherit;
  font-size: 1rem;
  cursor: pointer;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.25s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
