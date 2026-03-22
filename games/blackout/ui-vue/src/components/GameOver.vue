<script setup lang="ts">
import { useGameStore } from '../stores/game';
import { computed } from 'vue';

const store = useGameStore();

defineEmits<{
  restart: [];
}>();

const sortedPlayers = computed(() => {
  if (!store.room) return [];
  return [...store.room.players].sort((a, b) => b.score - a.score);
});

const topScore = computed(() => sortedPlayers.value[0]?.score ?? 0);

const winners = computed(() => {
  return sortedPlayers.value.filter((p) => p.score === topScore.value);
});
</script>

<template>
  <div class="game-over flex flex-col items-center gap-8 px-4 py-8">
    <h1 class="text-4xl font-black text-foreground">Game Over!</h1>

    <div class="text-center">
      <template v-if="winners.length === 1">
        <p class="ui-section-label">Winner</p>
        <h2 class="text-3xl font-bold text-blackout">{{ winners[0]?.name }}</h2>
      </template>
      <template v-else>
        <p class="ui-section-label">Tie!</p>
        <h2 class="text-3xl font-bold text-blackout">
          {{ winners.map((w) => w.name).join(' & ') }}
        </h2>
      </template>
      <p class="mt-1 text-xl text-foreground">{{ topScore }} points</p>
    </div>

    <div class="w-full max-w-xs">
      <h3 class="mb-3 text-center text-muted">Final Scores</h3>
      <div
        v-for="(player, index) in sortedPlayers"
        :key="player.id"
        class="mb-2 flex items-center gap-3 rounded-[--radius-sm] bg-elevated px-3 py-2.5"
        :class="player.score === topScore && 'border-2 border-blackout bg-blackout-muted'"
      >
        <span class="min-w-8 font-semibold text-muted-foreground">#{{ index + 1 }}</span>
        <span class="flex-1 text-foreground">{{ player.name }}</span>
        <span class="text-xl font-bold text-blackout">{{ player.score }}</span>
      </div>
    </div>

    <button
      v-if="store.isHost"
      class="ui-btn-primary !bg-blackout hover:!bg-blackout-hover"
      @click="$emit('restart')"
    >
      Play Again
    </button>
    <p v-else class="text-muted-foreground">Waiting for host to restart...</p>
  </div>
</template>
