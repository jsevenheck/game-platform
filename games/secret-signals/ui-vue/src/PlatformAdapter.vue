<script setup lang="ts">
/**
 * Platform adapter for Secret Signals.
 *
 * Maps PlatformGameProps → HubIntegrationProps and detects game-end via
 * the `phase-change` event emitted by the game component.
 */
import { ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import GameApp from './App.vue';

defineProps<{
  matchKey: string;
  playerId: string;
  playerName: string;
  namespace: string;
  joinToken?: string;
  isHost?: boolean;
  onReplayGame?: () => void;
  onReturnToLobby?: () => void;
  actionError?: string;
}>();

const { t } = useI18n();
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
      :join-token="joinToken"
      :is-host="isHost"
      @phase-change="onPhaseChange"
    />

    <Transition name="fade">
      <div v-if="gameEnded" class="platform-overlay ui-overlay">
        <div class="ui-dialog">
          <h2 class="mb-2 text-2xl font-extrabold">{{ t('replay.title') }}</h2>
          <template v-if="isHost">
            <p class="mb-6 text-sm text-muted-foreground">{{ t('replay.prompt') }}</p>
            <div class="flex flex-col gap-3">
              <button class="btn-replay" @click="onReplayGame?.()">
                {{ t('replay.playAgain') }}
              </button>
              <button class="btn-lobby ui-btn-secondary" @click="onReturnToLobby?.()">
                {{ t('replay.returnToLobby') }}
              </button>
            </div>
            <p v-if="actionError" class="mt-3 text-center text-sm text-danger">{{ actionError }}</p>
          </template>
          <p v-else class="mt-4 text-sm text-muted-foreground">{{ t('replay.waiting') }}</p>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.btn-replay {
  background: var(--color-signals);
  color: white;
}
.btn-replay:hover:not(:disabled) {
  background: var(--color-signals-hover);
}
</style>
