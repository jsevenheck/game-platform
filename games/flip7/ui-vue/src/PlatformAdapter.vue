<script setup lang="ts">
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

const gamePhase = ref('');
const gameEnded = computed(() => gamePhase.value === 'ended');

function onPhaseChange(phase: string) {
  gamePhase.value = phase;
}
</script>

<template>
  <div class="relative min-h-dvh">
    <GameApp
      :ws-namespace="namespace"
      :session-id="matchKey"
      :player-name="playerName"
      :player-id="playerId"
      :is-host="isHost"
      @phase-change="onPhaseChange"
    />

    <!-- Game-over overlay -->
    <Transition name="fade">
      <div v-if="gameEnded" class="ui-overlay flex items-center justify-center">
        <div class="ui-dialog flex flex-col gap-3 text-center">
          <template v-if="isHost">
            <p class="text-lg font-semibold text-foreground">Game Over!</p>
            <button class="ui-btn-primary btn-flip7" type="button" @click="onReplayGame?.()">
              Play Again
            </button>
            <button class="ui-btn-secondary" type="button" @click="onReturnToLobby?.()">
              Back to Party
            </button>
            <p v-if="actionError" class="mt-2 text-sm text-danger">{{ actionError }}</p>
          </template>
          <p v-else class="text-sm text-muted-foreground">Waiting for host to continue…</p>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.btn-flip7 {
  background: linear-gradient(135deg, var(--color-flip7) 0%, #fbbf24 100%);
  box-shadow: 0 2px 10px rgba(245, 158, 11, 0.3);
}

.btn-flip7:hover:not(:disabled) {
  background: linear-gradient(135deg, var(--color-flip7-hover) 0%, var(--color-flip7) 100%);
  box-shadow:
    0 0 22px rgba(245, 158, 11, 0.45),
    0 4px 14px rgba(0, 0, 0, 0.4);
}
</style>
