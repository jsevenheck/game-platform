<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import ScoreStandings, { type StandingEntry } from '@platform/components/ScoreStandings.vue';
import type { RoomView } from '@shared/types';
const props = defineProps<{ room: RoomView; isHost: boolean; pending: boolean }>();
const { t } = useI18n();
const emit = defineEmits<{ reveal: []; next: [] }>();
const isLast = computed(() => props.room.currentRound >= props.room.totalRounds);
const standings = computed<StandingEntry[]>(() => {
  const majorityIds = new Set(
    props.room.result?.groups.find((group) => group.answer === props.room.result?.majorityAnswer)
      ?.playerIds ?? []
  );
  return props.room.scores.map((score) => ({
    id: score.playerId,
    name: score.name,
    points: score.cows,
    delta: majorityIds.has(score.playerId) ? 1 : 0,
    note: score.hasPinkCow ? t('herd-mentality.gameOver.pinkCow') : undefined,
  }));
});
const formatCows = (cows: number) =>
  t(cows === 1 ? 'herd-mentality.gameOver.cow' : 'herd-mentality.gameOver.cows', { count: cows });
const groupText = (group: { playerNames: string[]; count: number }) =>
  `${group.playerNames.join(', ')} (${group.count})`;
</script>
<template>
  <section
    class="ui-panel"
    data-testid="herd-mentality-reveal"
    aria-labelledby="herd-mentality-reveal-title"
  >
    <p class="text-sm text-muted-foreground">
      {{
        t('herd-mentality.reveal.progress', {
          round: room.currentRound,
          total: room.totalRounds,
          cows: room.targetCows,
        })
      }}
    </p>
    <h2
      id="herd-mentality-reveal-title"
      class="mt-2 text-xl font-semibold"
      :data-phase-focus="room.phase === 'ended' ? undefined : ''"
      tabindex="-1"
    >
      {{ room.prompt?.text }}
    </h2>
    <div v-if="room.result" class="mt-5" data-testid="herd-mentality-groups" aria-live="polite">
      <h3 class="font-semibold">{{ t('herd-mentality.reveal.herdAnswers') }}</h3>
      <ul class="mt-3 space-y-2" :aria-label="t('herd-mentality.reveal.groups')">
        <li v-for="group in room.result.groups" :key="group.answer" class="ui-panel">
          <strong>{{ group.answer }}</strong> · {{ groupText(group) }}
          <span v-if="room.result.majorityAnswer === group.answer" class="ml-2 text-success">{{
            t('herd-mentality.reveal.cowPerPerson')
          }}</span>
        </li>
      </ul>
      <p v-if="room.result.pinkCowPlayerId" class="mt-3 text-warning">
        {{ t('herd-mentality.reveal.pinkCow') }}
      </p>
      <p v-if="room.winners.length" class="mt-3 text-success">
        {{
          t('herd-mentality.reveal.winners', {
            names: room.winners.map((winner) => winner.name).join(', '),
          })
        }}
      </p>
    </div>
    <p v-else class="mt-5 text-muted-foreground" role="status">
      {{ t('herd-mentality.reveal.allIn') }}
    </p>
    <ScoreStandings
      v-if="room.result && room.phase === 'reveal'"
      :entries="standings"
      :format-points="formatCows"
      test-id="herd-mentality-standings"
      class="mt-5"
    />
    <div v-if="isHost && room.phase === 'allSubmitted'" class="mt-5">
      <button
        class="ui-btn-primary"
        type="button"
        data-testid="herd-mentality-reveal-button"
        :disabled="pending"
        @click="emit('reveal')"
      >
        {{ pending ? t('herd-mentality.reveal.revealing') : t('herd-mentality.reveal.reveal') }}
      </button>
    </div>
    <div v-else-if="isHost && room.phase === 'reveal'" class="mt-5">
      <button
        class="ui-btn-primary"
        type="button"
        data-testid="herd-mentality-next-button"
        :disabled="pending"
        @click="emit('next')"
      >
        {{
          pending
            ? t('herd-mentality.reveal.loading')
            : isLast
              ? t('herd-mentality.reveal.finalScore')
              : t('herd-mentality.reveal.next')
        }}
      </button>
    </div>
    <p v-else-if="room.phase === 'allSubmitted'" class="mt-5 text-muted-foreground" role="status">
      {{ t('herd-mentality.reveal.waitingForHost') }}
    </p>
  </section>
</template>

<style scoped>
[data-testid='herd-mentality-reveal'] {
  width: 100%;
  min-width: 0;
  max-width: 100%;
  box-sizing: border-box;
}
[data-testid='herd-mentality-reveal'] h2,
[data-testid='herd-mentality-reveal'] li,
[data-testid='herd-mentality-reveal'] strong {
  max-width: 100%;
  white-space: normal;
  overflow-wrap: anywhere;
  word-break: break-word;
}
</style>
