<script setup lang="ts">
import { computed } from 'vue';
import type { ScoreEntry } from '@shared/types';
const props = defineProps<{ scores: ScoreEntry[] }>();
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
      Endergebnis
    </h2>
    <ol class="ui-player-list mt-4" aria-label="Rangliste">
      <li v-for="(score, index) in sorted" :key="score.playerId" class="ui-player-item">
        <span aria-hidden="true">{{ index + 1 }}.</span
        ><span class="ui-avatar" aria-hidden="true">{{ score.name.charAt(0).toUpperCase() }}</span
        ><span>{{ score.name }}</span
        ><span class="ml-auto font-semibold"
          >{{ score.cows }} Kühe<span v-if="score.hasPinkCow"> · Pink Cow</span></span
        >
      </li>
    </ol>
  </section>
</template>
