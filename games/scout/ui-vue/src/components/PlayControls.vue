<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { ScoutCard } from '@shared/deck';
import type { PlayedSetView } from '@shared/types';
import { useGameStore } from '../stores/game';
import Card from './Card.vue';

const props = defineProps<{
  currentPlay: PlayedSetView | null;
}>();

const emit = defineEmits<{
  playCards: [payload: { startIndex: number; count: number }];
  scout: [];
}>();

const store = useGameStore();
const selectedIndexes = ref<number[]>([]);

const sortedSelected = computed(() => [...selectedIndexes.value].sort((a, b) => a - b));
const isContiguous = computed(() => {
  if (sortedSelected.value.length === 0) return false;
  return sortedSelected.value.every(
    (value, index, arr) => index === 0 || value === arr[index - 1] + 1
  );
});
const selectedCards = computed(() =>
  sortedSelected.value.map((index) => store.myRow[index]).filter(Boolean)
);
const selectedSummary = computed(() => summarize(selectedCards.value));
const beatsPlay = computed(() => {
  if (!props.currentPlay) return selectedCards.value.length > 0;
  const summary = selectedSummary.value;
  if (summary.sum !== props.currentPlay.sum) return summary.sum > props.currentPlay.sum;
  if (summary.count !== props.currentPlay.count) return summary.count > props.currentPlay.count;
  return summary.highCard > props.currentPlay.highCard;
});
const canPlay = computed(() => store.isMyTurn && isContiguous.value && beatsPlay.value);

function summarize(cards: ScoutCard[]) {
  return {
    sum: cards.reduce((total, card) => total + card.playValue, 0),
    count: cards.length,
    highCard: Math.max(0, ...cards.map((card) => card.playValue)),
  };
}

function toggle(index: number) {
  if (!store.isMyTurn) return;
  selectedIndexes.value = selectedIndexes.value.includes(index)
    ? selectedIndexes.value.filter((value) => value !== index)
    : [...selectedIndexes.value, index];
}

function playSelected() {
  if (!canPlay.value) return;
  emit('playCards', { startIndex: sortedSelected.value[0], count: sortedSelected.value.length });
  selectedIndexes.value = [];
}

watch(
  () => store.currentTurnPlayerId,
  () => {
    selectedIndexes.value = [];
  }
);
</script>

<template>
  <section class="ui-panel">
    <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 class="text-lg font-bold">Your row</h2>
        <p class="text-sm text-muted">Select adjacent cards to play.</p>
      </div>
      <div v-if="selectedCards.length" class="text-sm text-muted">
        Sum {{ selectedSummary.sum }} · {{ selectedSummary.count }} card(s) · High
        {{ selectedSummary.highCard }}
      </div>
    </div>

    <div class="flex gap-2 overflow-x-auto py-4">
      <button
        v-for="(card, index) in store.myRow"
        :key="card.id"
        class="rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-scout"
        type="button"
        :disabled="!store.isMyTurn"
        @click="toggle(index)"
      >
        <Card
          :card="card"
          :selected="selectedIndexes.includes(index)"
          :disabled="!store.isMyTurn"
          compact
        />
      </button>
    </div>

    <div class="mt-4 flex flex-wrap gap-3">
      <button
        class="ui-btn-primary btn-scout"
        type="button"
        :disabled="!canPlay"
        @click="playSelected"
      >
        Play selected
      </button>
      <button
        class="ui-btn-secondary"
        type="button"
        :disabled="!store.isMyTurn || !currentPlay"
        @click="emit('scout')"
      >
        Pass / Scout
      </button>
      <p
        v-if="store.isMyTurn && selectedCards.length && !isContiguous"
        class="self-center text-sm text-danger"
      >
        Selection must be contiguous.
      </p>
      <p
        v-else-if="store.isMyTurn && selectedCards.length && !beatsPlay"
        class="self-center text-sm text-danger"
      >
        Selection does not beat the table.
      </p>
    </div>
  </section>
</template>

<style scoped>
.btn-scout {
  background: linear-gradient(135deg, var(--color-scout) 0%, #22d3ee 100%);
}
</style>
