<script setup lang="ts">
import { useGameStore } from '../stores/game';

const store = useGameStore();
</script>

<template>
  <aside
    class="mx-auto mt-4 w-full max-w-xs rounded-[--radius-md] border border-border bg-shell p-3"
  >
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
      <span
        class="truncate"
        :class="store.currentRound?.readerId === player.id ? 'text-warning' : 'text-foreground'"
        >{{ player.name }}</span
      >
      <span class="font-bold text-blackout">{{ player.score }}</span>
    </div>
  </aside>
</template>
