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
      <div v-if="gameEnded && isHost" class="ui-overlay">
        <div class="ui-dialog">
          <h2 class="mb-2 text-2xl font-extrabold">Match Over</h2>
          <p class="mb-6 text-sm text-muted-foreground">What would you like to do?</p>
          <div class="flex flex-col gap-3">
            <button class="ui-btn-primary" @click="onReplayGame?.()">Play Again</button>
            <button class="ui-btn-secondary" @click="onReturnToLobby?.()">Back to Party</button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>
