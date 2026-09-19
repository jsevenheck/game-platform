<script setup lang="ts">
import type { ScoreEntry } from '@shared/types';

defineProps<{ scores: ScoreEntry[] }>();
</script>

<template>
  <section class="ui-panel" data-testid="kritzelagent-game-over" aria-labelledby="game-over-title">
    <p class="text-sm text-muted-foreground">Alle Runden gespielt</p>
    <h2 id="game-over-title" data-phase-focus tabindex="-1">Kritzelagent beendet</h2>
    <ol class="kritzelagent-leaderboard" aria-label="Endstand">
      <li
        v-for="(score, index) in scores.slice().sort((a, b) => b.points - a.points)"
        :key="score.playerId"
      >
        <span
          ><strong>{{ index + 1 }}.</strong> {{ score.name }}</span
        ><strong>{{ score.points }} Punkte</strong>
      </li>
    </ol>
  </section>
</template>

<style scoped>
.kritzelagent-leaderboard {
  display: grid;
  gap: 0.5rem;
  margin-top: 1.25rem;
  padding: 0;
  list-style: none;
}
.kritzelagent-leaderboard li {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  border-bottom: 1px solid var(--color-border);
  padding: 0.6rem 0;
}
</style>
