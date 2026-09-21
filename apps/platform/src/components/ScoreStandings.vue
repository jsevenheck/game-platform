<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

export interface StandingEntry {
  id: string;
  name: string;
  points: number;
  /** Points gained in the round that just ended; shown as a "+n" badge when positive. */
  delta?: number;
  /** Optional short annotation next to the name (e.g. a special token). */
  note?: string;
}

const props = defineProps<{
  entries: StandingEntry[];
  myId?: string;
  /** Formats a score with its unit, e.g. `1 point` / `3 cows`. */
  formatPoints: (points: number) => string;
  /** Overrides the default "Standings" heading. */
  title?: string;
  testId?: string;
}>();

const { t } = useI18n();
const headingId = `standings-title-${Math.random().toString(36).slice(2, 8)}`;

/** Sorted by points (stable); players with equal points share a rank. */
const rows = computed(() => {
  const sorted = props.entries
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => b.entry.points - a.entry.points || a.index - b.index)
    .map(({ entry }) => entry);
  return sorted.map((entry) => ({
    ...entry,
    rank: sorted.findIndex((other) => other.points === entry.points) + 1,
    isMine: entry.id === props.myId,
    gained: (entry.delta ?? 0) > 0 ? entry.delta! : 0,
  }));
});
</script>

<template>
  <section class="standings" :data-testid="testId ?? 'standings'" :aria-labelledby="headingId">
    <h3 :id="headingId" class="ui-section-label">{{ title ?? t('standings.title') }}</h3>
    <ol class="ui-player-list mt-2">
      <li
        v-for="row in rows"
        :key="row.id"
        class="ui-player-item standings-row"
        :class="{ mine: row.isMine }"
        :aria-current="row.isMine ? 'true' : undefined"
      >
        <span class="rank" aria-hidden="true">{{ row.rank }}.</span>
        <span class="ui-avatar" aria-hidden="true">{{ row.name.charAt(0).toUpperCase() }}</span>
        <span class="standings-name">{{ row.name }}</span>
        <span v-if="row.note" class="standings-note">{{ row.note }}</span>
        <span v-if="row.gained" class="round-gain">
          <span aria-hidden="true">+{{ row.gained }}</span>
          <span class="sr-only">{{ t('standings.gain', { n: row.gained }) }}</span>
        </span>
        <span class="standings-points">{{ formatPoints(row.points) }}</span>
      </li>
    </ol>
  </section>
</template>

<style scoped>
/* Rows wrap instead of overflowing on narrow screens or with enlarged text. */
.standings-row {
  flex-wrap: wrap;
  row-gap: 0.25rem;
}

.standings-name {
  flex: 1 1 5rem;
  min-width: 0;
  overflow-wrap: anywhere;
}

.standings-points {
  margin-left: auto;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

@media (max-width: 420px) {
  .standings-row {
    gap: 0.5rem;
  }

  .standings-row .ui-avatar {
    display: none;
  }
}

.rank {
  min-width: 1.5rem;
  color: var(--color-muted-foreground);
  font-variant-numeric: tabular-nums;
}

.mine {
  border-color: var(--color-accent, #f97316);
}

.standings-note {
  color: var(--color-muted-foreground);
  font-size: 0.75rem;
}

.round-gain {
  padding: 0 0.4rem;
  border-radius: 999px;
  color: var(--color-success, #22c55e);
  background: var(--color-success-muted, rgba(34, 197, 94, 0.15));
  font-size: 0.75rem;
  font-weight: 700;
}
</style>
