<script setup lang="ts">
import { computed } from 'vue';
import type { ScoreEntry } from '@shared/types';

const props = defineProps<{
  scores: ScoreEntry[];
  myScore: number;
}>();

const sortedScores = computed(() => [...props.scores].sort((a, b) => b.points - a.points));
</script>

<template>
  <section
    class="ui-panel"
    data-testid="estimate-gameover"
    aria-labelledby="estimate-gameover-title"
  >
    <h2 id="estimate-gameover-title" class="text-xl font-semibold" data-phase-focus tabindex="-1">
      Endergebnis
    </h2>
    <p class="mt-2 text-lg">
      Deine Punkte: <strong>{{ myScore }}</strong>
    </p>
    <ol class="mt-4 ui-player-list" aria-label="Rangliste">
      <li v-for="(score, index) in sortedScores" :key="score.playerId" class="ui-player-item">
        <span class="rank" aria-hidden="true">{{ index + 1 }}.</span>
        <span class="ui-avatar" aria-hidden="true">{{ score.name.charAt(0).toUpperCase() }}</span>
        <span>{{ score.name }}</span>
        <span class="ml-auto font-semibold">
          {{ score.points }} {{ score.points === 1 ? 'Punkt' : 'Punkte' }}
        </span>
      </li>
    </ol>
  </section>
</template>

<style scoped>
.rank {
  min-width: 1.5rem;
  color: var(--color-muted-foreground);
  font-variant-numeric: tabular-nums;
}
</style>
