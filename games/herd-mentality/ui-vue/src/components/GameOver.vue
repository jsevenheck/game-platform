<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { ScoreEntry } from '@shared/types';
const props = defineProps<{ scores: ScoreEntry[] }>();
const { t } = useI18n();
const sorted = computed(() =>
  [...props.scores].sort((a, b) => b.cows - a.cows || a.name.localeCompare(b.name))
);
</script>
<template>
  <section
    class="ui-panel"
    data-testid="herd-mentality-gameover"
    aria-labelledby="herd-mentality-gameover-title"
  >
    <h2
      id="herd-mentality-gameover-title"
      class="text-xl font-semibold"
      data-phase-focus
      tabindex="-1"
    >
      {{ t('herd-mentality.gameOver.title') }}
    </h2>
    <ol class="ui-player-list mt-4" :aria-label="t('herd-mentality.gameOver.ranking')">
      <li v-for="(score, index) in sorted" :key="score.playerId" class="ui-player-item">
        <span aria-hidden="true">{{ index + 1 }}.</span
        ><span class="ui-avatar" aria-hidden="true">{{ score.name.charAt(0).toUpperCase() }}</span
        ><span>{{ score.name }}</span
        ><span class="ml-auto font-semibold"
          >{{
            t(score.cows === 1 ? 'herd-mentality.gameOver.cow' : 'herd-mentality.gameOver.cows', {
              count: score.cows,
            })
          }}<span v-if="score.hasPinkCow"> · {{ t('herd-mentality.gameOver.pinkCow') }}</span></span
        >
      </li>
    </ol>
  </section>
</template>
