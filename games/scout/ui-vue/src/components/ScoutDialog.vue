<script setup lang="ts">
import { computed, shallowRef } from 'vue';
import { useI18n } from 'vue-i18n';
import { analyzePlay, comparePlayAnalyses } from '@shared/analyzePlay';
import { flipCard, type ScoutCard } from '@shared/deck';
import type { RoomView } from '@shared/types';
import { useGameStore } from '../stores/game';
import Card from './Card.vue';

const props = defineProps<{
  room: RoomView;
}>();

const emit = defineEmits<{
  close: [];
  scout: [
    payload: {
      cardId: string;
      insertIndex: number;
      flip?: boolean;
      thenPlay?: { startIndex: number; count: number };
    },
  ];
}>();

const { t } = useI18n();
const store = useGameStore();
const selectedCardId = shallowRef<string | undefined>();
const insertIndex = shallowRef(0);
const flipSelected = shallowRef(false);
const useScoutAndShow = shallowRef(false);
const selectedPreviewIndexes = shallowRef<number[]>([]);

const currentCards = computed(() => props.room.trick?.currentPlay?.cards ?? []);
const currentOwnerName = computed(() => {
  const ownerId = props.room.trick?.priorSetOwnerId;
  return (
    props.room.players.find((player) => player.id === ownerId)?.name ?? t('scout.playerFallback')
  );
});
const edgeCards = computed(() => {
  const cards = currentCards.value;
  if (cards.length <= 1) return cards;
  return [cards[0], cards[cards.length - 1]];
});
const selectedCard = computed(
  () => edgeCards.value.find((card) => card.id === selectedCardId.value) ?? edgeCards.value[0]
);
const orientedScoutCard = computed<ScoutCard | null>(() => {
  const card = selectedCard.value;
  if (!card) return null;
  return flipSelected.value ? flipCard(card) : card;
});
const previewRow = computed<ScoutCard[]>(() => {
  const card = orientedScoutCard.value;
  if (!card) return store.myRow;
  const row = [...store.myRow];
  row.splice(Math.min(insertIndex.value, row.length), 0, card);
  return row;
});
const sortedPreviewIndexes = computed(() =>
  [...selectedPreviewIndexes.value].sort((a, b) => a - b)
);
const selectedPreviewCards = computed(() =>
  sortedPreviewIndexes.value.flatMap((index) => {
    const card = previewRow.value[index];
    return card ? [card] : [];
  })
);
const previewSelectionContiguous = computed(() => {
  if (sortedPreviewIndexes.value.length === 0) return false;
  return sortedPreviewIndexes.value.every(
    (value, index, arr) => index === 0 || value === arr[index - 1] + 1
  );
});
const scoutAndShowValid = computed(() => {
  if (!useScoutAndShow.value) return false;
  if (!previewSelectionContiguous.value || selectedPreviewCards.value.length === 0) return false;
  try {
    const candidate = analyzePlay(selectedPreviewCards.value);
    const remainingPriorSet = currentCards.value.filter(
      (card) => card.id !== selectedCard.value?.id
    );
    if (remainingPriorSet.length === 0) return true;
    return comparePlayAnalyses(candidate, analyzePlay(remainingPriorSet)) > 0;
  } catch {
    return false;
  }
});
const canScout = computed(() => Boolean(selectedCard.value));
const hasScoutAndShowToken = computed(() => (store.self?.scoutAndShowTokens ?? 0) > 0);

function chooseCard(cardId: string) {
  selectedCardId.value = cardId;
  selectedPreviewIndexes.value = [];
}

function setInsertIndex(index: number) {
  insertIndex.value = index;
  selectedPreviewIndexes.value = [];
}

function togglePreviewIndex(index: number) {
  selectedPreviewIndexes.value = selectedPreviewIndexes.value.includes(index)
    ? selectedPreviewIndexes.value.filter((value) => value !== index)
    : [...selectedPreviewIndexes.value, index];
}

function submit(scoutAndShow: boolean) {
  const card = selectedCard.value;
  if (!card) return;

  const payload: {
    cardId: string;
    insertIndex: number;
    flip?: boolean;
    thenPlay?: { startIndex: number; count: number };
  } = {
    cardId: card.id,
    insertIndex: insertIndex.value,
    flip: flipSelected.value,
  };

  if (scoutAndShow) {
    if (!scoutAndShowValid.value) return;
    payload.thenPlay = {
      startIndex: sortedPreviewIndexes.value[0],
      count: sortedPreviewIndexes.value.length,
    };
  }

  emit('scout', payload);
}
</script>

<template>
  <div class="ui-overlay">
    <section class="ui-dialog max-w-5xl text-left">
      <div class="mb-5 flex items-center justify-between gap-4">
        <div>
          <h2 class="text-2xl font-black text-foreground">{{ t('scout.dialog.title') }}</h2>
          <p class="text-sm text-muted">
            {{ t('scout.dialog.intro', { owner: currentOwnerName }) }}
          </p>
        </div>
        <button
          class="ui-btn-ghost"
          type="button"
          :aria-label="t('scout.dialog.close')"
          @click="emit('close')"
        >
          ✕
        </button>
      </div>

      <div class="space-y-5">
        <section>
          <h3 class="ui-section-label mb-2">{{ t('scout.dialog.edgeCards') }}</h3>
          <div class="flex gap-3 overflow-x-auto rounded-xl border border-border bg-card p-3">
            <button
              v-for="card in edgeCards"
              :key="card.id"
              type="button"
              class="rounded-xl"
              @click="chooseCard(card.id)"
            >
              <Card :card="card" :selected="selectedCard?.id === card.id" compact />
            </button>
          </div>
        </section>

        <section>
          <h3 class="ui-section-label mb-2">{{ t('scout.dialog.insertPosition') }}</h3>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="index in store.myRow.length + 1"
              :key="index - 1"
              class="ui-btn-secondary px-3 py-2 text-xs"
              :class="insertIndex === index - 1 ? 'border-scout text-scout' : ''"
              type="button"
              @click="setInsertIndex(index - 1)"
            >
              {{
                index > store.myRow.length
                  ? t('scout.dialog.end')
                  : t('scout.dialog.beforeIndex', { index })
              }}
            </button>
          </div>
        </section>

        <section>
          <h3 class="ui-section-label mb-2">{{ t('scout.dialog.orientation') }}</h3>
          <div class="flex flex-wrap items-center gap-3">
            <button
              class="ui-btn-secondary"
              :class="!flipSelected ? 'border-scout text-scout' : ''"
              type="button"
              @click="flipSelected = false"
            >
              {{ t('scout.dialog.keep') }}
            </button>
            <button
              class="ui-btn-secondary"
              :class="flipSelected ? 'border-scout text-scout' : ''"
              type="button"
              @click="flipSelected = true"
            >
              {{ t('scout.dialog.flip') }}
            </button>
            <Card v-if="orientedScoutCard" :card="orientedScoutCard" compact />
          </div>
        </section>

        <section v-if="hasScoutAndShowToken">
          <div class="mb-2 flex flex-wrap items-center justify-between gap-3">
            <h3 class="ui-section-label">{{ t('scout.dialog.preview') }}</h3>
            <label class="flex items-center gap-2 text-sm text-muted">
              <input v-model="useScoutAndShow" type="checkbox" />
              {{ t('scout.dialog.useToken', { count: store.self?.scoutAndShowTokens ?? 0 }) }}
            </label>
          </div>
          <div class="flex gap-2 overflow-x-auto rounded-xl border border-border bg-card p-3">
            <button
              v-for="(card, index) in previewRow"
              :key="`${card.id}-${index}`"
              type="button"
              class="rounded-xl"
              :disabled="!useScoutAndShow"
              @click="togglePreviewIndex(index)"
            >
              <Card
                :card="card"
                :selected="selectedPreviewIndexes.includes(index)"
                :disabled="!useScoutAndShow"
                compact
              />
            </button>
          </div>
          <p
            v-if="useScoutAndShow && selectedPreviewCards.length && !scoutAndShowValid"
            class="mt-2 text-sm text-danger"
          >
            {{ t('scout.dialog.invalidShow') }}
          </p>
        </section>

        <div class="grid gap-3 sm:grid-cols-2">
          <button
            class="ui-btn-secondary"
            type="button"
            :disabled="!canScout"
            @click="submit(false)"
          >
            {{ t('scout.dialog.confirmScout') }}
          </button>
          <button
            class="ui-btn-primary btn-scout"
            type="button"
            :disabled="!hasScoutAndShowToken || !scoutAndShowValid"
            @click="submit(true)"
          >
            {{ t('scout.dialog.confirmScoutAndShow') }}
          </button>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.btn-scout {
  background: linear-gradient(135deg, var(--color-scout) 0%, #22d3ee 100%);
}
</style>
