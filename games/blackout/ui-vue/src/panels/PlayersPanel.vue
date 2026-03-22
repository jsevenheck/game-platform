<script setup lang="ts">
import { useGameStore } from '../stores/game';

const store = useGameStore();
</script>

<template>
  <aside class="fixed right-4 top-16 w-40 rounded-[--radius-md] border border-border bg-shell p-3 md:static md:mx-auto md:w-full md:max-w-xs">
    <h4 class="ui-section-label">Players</h4>
    <div
      v-for="player in store.room?.players"
      :key="player.id"
      class="mb-1 flex justify-between rounded px-1.5 py-1 text-sm"
      :class="[
        player.id === store.playerId && 'bg-blackout-muted',
        !player.connected && 'opacity-40',
      ]"
    >
      <span class="truncate" :class="store.currentRound?.readerId === player.id ? 'text-warning' : 'text-foreground'">{{ player.name }}</span>
      <span class="font-bold text-blackout">{{ player.score }}</span>
    </div>
  </aside>
</template>
