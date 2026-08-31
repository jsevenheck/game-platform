<script setup lang="ts">
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
</script>

<template>
  <GameApp
    :ws-namespace="namespace"
    :session-id="matchKey"
    :player-id="playerId"
    :player-name="playerName"
    :join-token="joinToken"
    :is-host="isHost"
  />
</template>
