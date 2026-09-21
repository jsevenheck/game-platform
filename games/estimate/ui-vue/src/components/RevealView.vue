<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import NumberLine from './NumberLine.vue';
import ScoreStandings, { type StandingEntry } from '@platform/components/ScoreStandings.vue';
import type { RoomView } from '@shared/types';

const props = defineProps<{
  room: RoomView;
  isHost: boolean;
  myId: string;
  pending: boolean;
}>();

const emit = defineEmits<{ reveal: []; next: [] }>();
const { t, locale } = useI18n();
const numberFormatter = computed(
  () => new Intl.NumberFormat(locale.value, { maximumFractionDigits: 6 })
);
const standings = computed<StandingEntry[]>(() => {
  const winnerIds = new Set(props.room.winners.map((winner) => winner.playerId));
  return props.room.scores.map((score) => ({
    id: score.playerId,
    name: score.name,
    points: score.points,
    delta: winnerIds.has(score.playerId) ? 1 : 0,
  }));
});
const formatPoints = (points: number) =>
  `${points} ${points === 1 ? t('estimate.scoreboard.point') : t('estimate.scoreboard.points')}`;
const isLastRound = computed(() => props.room.currentRound >= props.room.totalRounds);
</script>

<template>
  <section class="ui-panel" data-testid="estimate-reveal" aria-labelledby="estimate-reveal-title">
    <p class="text-sm text-muted-foreground">
      {{ t('estimate.question.round', { round: room.currentRound, total: room.totalRounds }) }}
    </p>
    <h2
      id="estimate-reveal-title"
      class="mt-2 text-xl font-semibold estimate-question-heading"
      data-phase-focus
      tabindex="-1"
    >
      {{ room.question?.text }}
    </h2>

    <NumberLine :room="room" :my-id="myId" class="mt-4" />

    <div
      v-if="room.solution !== null"
      class="mt-4"
      data-testid="estimate-revealed-banner"
      role="status"
      aria-live="polite"
    >
      <p class="text-lg">
        {{ t('estimate.reveal.solution') }}
        <strong>{{ numberFormatter.format(room.solution) }}</strong>
      </p>
      <p v-if="room.winners.length > 0" class="text-success mt-1">
        {{ t('estimate.reveal.winners') }}
        {{ room.winners.map((winner) => winner.name).join(', ') }}
      </p>
    </div>

    <ScoreStandings
      v-if="room.solution !== null"
      :entries="standings"
      :my-id="myId"
      :format-points="formatPoints"
      test-id="estimate-scoreboard"
      class="mt-5"
    />

    <div v-if="isHost" class="mt-4 flex min-w-0 flex-wrap gap-2 estimate-reveal-actions">
      <button
        v-if="room.solution === null"
        class="ui-btn-primary"
        type="button"
        :disabled="pending"
        data-testid="estimate-reveal-button"
        @click="emit('reveal')"
      >
        {{ pending ? t('estimate.reveal.revealing') : t('estimate.reveal.reveal') }}
      </button>
      <button
        v-else
        class="ui-btn-primary"
        type="button"
        :disabled="pending"
        data-testid="estimate-next-button"
        @click="emit('next')"
      >
        {{
          pending
            ? t('estimate.reveal.loading')
            : isLastRound
              ? t('estimate.reveal.finalScore')
              : t('estimate.reveal.next')
        }}
      </button>
    </div>
    <p v-else-if="room.solution === null" class="text-muted-foreground mt-4" role="status">
      {{ t('estimate.reveal.waitingForHost') }}
    </p>
  </section>
</template>

<style scoped>
.estimate-question-heading {
  overflow-wrap: anywhere;
}

.estimate-reveal-actions .ui-btn-primary {
  max-width: 100%;
  min-width: 0;
  white-space: normal;
}
</style>
