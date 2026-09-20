<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import type { ScoreEntry } from '@shared/types';

defineProps<{ scores: ScoreEntry[] }>();
const { t } = useI18n();
</script>

<template>
  <section class="ui-panel" data-testid="kritzelagent-game-over" aria-labelledby="game-over-title">
    <p class="text-sm text-muted-foreground">{{ t('kritzelagent.gameOver.subtitle') }}</p>
    <h2 id="game-over-title" data-phase-focus tabindex="-1">
      {{ t('kritzelagent.gameOver.title') }}
    </h2>
    <ol class="kritzelagent-leaderboard" :aria-label="t('kritzelagent.gameOver.ranking')">
      <li
        v-for="(score, index) in scores.slice().sort((a, b) => b.points - a.points)"
        :key="score.playerId"
      >
        <span
          ><strong>{{ index + 1 }}.</strong> {{ score.name }}</span
        ><strong>{{
          t(score.points === 1 ? 'kritzelagent.gameOver.point' : 'kritzelagent.gameOver.points', {
            count: score.points,
          })
        }}</strong>
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
