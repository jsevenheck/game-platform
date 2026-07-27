<script setup lang="ts">
import { ref, computed } from 'vue';
import GameApp from './App.vue';

interface Props {
  matchKey: string;
  playerId: string;
  playerName: string;
  namespace: string;
  joinToken?: string;
  isHost?: boolean;
  onReplayGame?: () => void;
  onReturnToLobby?: () => void;
  actionError?: string;
}

const props = withDefaults(defineProps<Props>(), {
  joinToken: '',
  isHost: false,
  onReplayGame: undefined,
  onReturnToLobby: undefined,
  actionError: '',
});

// Touch props so eslint-no-unused-vars is satisfied even though the
// template only reads the matching props.
void props;

const gamePhase = ref('');
const gameEnded = computed(() => gamePhase.value === 'gameEnd');

function onPhaseChange(phase: string) {
  gamePhase.value = phase;
}
</script>

<template>
  <div class="platform-game-wrapper">
    <GameApp
      :ws-namespace="namespace"
      :session-id="matchKey"
      :player-name="playerName"
      :player-id="playerId"
      :join-token="joinToken"
      :is-host="isHost"
      @phase-change="onPhaseChange"
    />

    <div v-if="gameEnded && isHost" class="platform-overlay">
      <button class="ui-btn-primary" type="button" @click="onReplayGame?.()">
        Nochmal spielen
      </button>
      <button class="ui-btn-secondary mt-2" type="button" @click="onReturnToLobby?.()">
        Zurück zur Party
      </button>
      <p v-if="actionError" class="mt-3 text-center text-sm text-danger">{{ actionError }}</p>
    </div>

    <div v-else-if="gameEnded" class="platform-overlay">
      <p class="text-sm text-muted-foreground">Warte auf den Host…</p>
    </div>
  </div>
</template>

<style scoped>
.platform-game-wrapper {
  position: relative;
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
}

.platform-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  background: rgba(5, 5, 9, 0.75);
  padding: 1.5rem;
  text-align: center;
}
</style>
