<script setup lang="ts">
import { useGameStore } from '../stores/game';
import { computed } from 'vue';

const store = useGameStore();

const sortedPlayers = computed(() => {
  if (!store.room) return [];
  return [...store.room.players].sort((a, b) => b.score - a.score);
});

const lastResult = computed(() => {
  if (!store.room) return null;
  const history = store.room.roundHistory;
  return history.length > 0 ? history[history.length - 1] : null;
});

const winnerName = computed(() => {
  if (!lastResult.value?.winnerId) return null;
  return store.room?.players.find((p) => p.id === lastResult.value!.winnerId)?.name;
});
</script>

<template>
  <div class="flex flex-col items-center gap-6 px-4 py-8">
    <h2 class="text-foreground">Round {{ lastResult?.roundNumber }} Complete!</h2>

    <div
      v-if="winnerName"
      class="rounded-[--radius-md] bg-blackout px-8 py-3 text-xl font-semibold text-white"
    >
      {{ winnerName }} got it right!
    </div>
    <div v-else class="rounded-[--radius-md] bg-elevated px-8 py-3 text-muted">
      Round skipped - no correct answer
    </div>

    <div class="w-full max-w-xs">
      <div
        v-for="(player, index) in sortedPlayers"
        :key="player.id"
        class="mb-2 flex items-center gap-3 rounded-[--radius-sm] bg-elevated px-3 py-2.5"
        :class="index === 0 && 'border-2 border-blackout'"
      >
        <span class="min-w-8 font-semibold text-muted-foreground">#{{ index + 1 }}</span>
        <span class="flex-1 text-foreground">{{ player.name }}</span>
        <span class="text-xl font-bold text-blackout">{{ player.score }}</span>
      </div>
    </div>

    <p class="animate-pulse text-muted-foreground">Next round starting...</p>
  </div>
</template>
