<script setup lang="ts">
/**
 * Platform adapter for Secret Signals.
 *
 * Maps PlatformGameProps → HubIntegrationProps and detects game-end via
 * the `phase-change` event emitted by the game component.
 */
import { ref, computed } from 'vue';
import GameApp from './App.vue';

defineProps<{
  matchKey: string;
  playerId: string;
  playerName: string;
  namespace: string;
  isHost?: boolean;
  onReplayGame?: () => void;
  onReturnToLobby?: () => void;
  actionError?: string;
}>();

const gamePhase = ref<string | null>(null);
const gameEnded = computed(() => gamePhase.value === 'ended');

function onPhaseChange(phase: string) {
  gamePhase.value = phase;
}
</script>

<template>
  <div class="relative min-h-dvh">
    <GameApp
      :player-id="playerId"
      :player-name="playerName"
      :session-id="matchKey"
      :ws-namespace="namespace"
      :is-host="isHost"
      @phase-change="onPhaseChange"
    />

    <Transition name="fade">
      <div v-if="gameEnded" class="platform-overlay ui-overlay">
        <div class="ui-dialog">
          <h2 class="mb-2 text-2xl font-extrabold">Match Over</h2>
          <template v-if="isHost">
            <p class="mb-6 text-sm text-muted-foreground">What would you like to do?</p>
            <div class="flex flex-col gap-3">
              <button class="btn-replay ui-btn-primary bg-signals!" @click="onReplayGame?.()">
                Play Again
              </button>
              <button class="btn-lobby ui-btn-secondary" @click="onReturnToLobby?.()">
                Back to Party
              </button>
            </div>
            <p v-if="actionError" class="mt-3 text-center text-sm text-danger">{{ actionError }}</p>
          </template>
          <p v-else class="mt-4 text-sm text-muted-foreground">Waiting for host to decide...</p>
        </div>
      </div>
    </Transition>
  </div>
</template>
