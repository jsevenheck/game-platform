<script setup lang="ts">
import { computed } from 'vue';
import { useGameStore } from '../stores/game';

const emit = defineEmits<{ playAgain: [] }>();
const store = useGameStore();

const rankedPlayers = computed(() =>
  [...(store.room?.players ?? [])].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.takenCount - a.takenCount;
  })
);
</script>

<template>
  <main class="mx-auto flex min-h-dvh max-w-3xl flex-col justify-center gap-6 p-6">
    <section class="ui-panel text-center">
      <p class="text-sm font-semibold uppercase tracking-[0.3em] text-scout">Game over</p>
      <h1 class="mt-2 text-4xl font-black text-foreground">
        {{ store.room?.winnerIds.includes(store.playerId) ? 'You win!' : 'Final scores' }}
      </h1>
      <p class="mt-3 text-muted">Scores count scout points from collected tricks.</p>
    </section>

    <section class="ui-panel">
      <ol class="space-y-3">
        <li
          v-for="(player, index) in rankedPlayers"
          :key="player.id"
          class="flex items-center justify-between rounded-xl border border-border bg-card p-4"
          :class="store.room?.winnerIds.includes(player.id) ? 'border-scout bg-scout-muted' : ''"
        >
          <div>
            <p class="font-bold text-foreground">
              #{{ index + 1 }} {{ player.name
              }}<span v-if="player.id === store.playerId"> (you)</span>
            </p>
            <p class="text-sm text-muted">{{ player.takenCount }} cards taken</p>
          </div>
          <p class="font-mono text-2xl font-black text-scout">{{ player.score }}</p>
        </li>
      </ol>
    </section>

    <button
      v-if="store.isHost"
      class="ui-btn-primary btn-scout"
      type="button"
      @click="emit('playAgain')"
    >
      Play Again
    </button>
  </main>
</template>

<style scoped>
.btn-scout {
  background: linear-gradient(135deg, var(--color-scout) 0%, #22d3ee 100%);
}
</style>
