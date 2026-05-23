<script setup lang="ts">
import { computed, shallowRef } from 'vue';
import type { PlayedSetView, RoomView } from '@shared/types';
import Card from './Card.vue';

const props = defineProps<{
  room: RoomView;
}>();

const emit = defineEmits<{
  close: [];
  scout: [
    payload: {
      source: 'showPile' | 'table';
      side: 'left' | 'right';
      cardId?: string;
      fromPlayerId?: string;
    },
  ];
}>();

const selectedSource = shallowRef<'showPile' | 'table'>('showPile');
const selectedCardId = shallowRef<string | undefined>();
const selectedFromPlayerId = shallowRef<string | undefined>();
const selectedSide = shallowRef<'left' | 'right'>('right');

const tableCards = computed(() =>
  (props.room.trick?.plays ?? []).flatMap((play: PlayedSetView) =>
    play.cards.map((card) => ({ card, playerId: play.playerId }))
  )
);

function playerName(playerId: string): string {
  return props.room.players.find((player) => player.id === playerId)?.name ?? 'Player';
}

function chooseShowPile(cardId?: string) {
  selectedSource.value = 'showPile';
  selectedCardId.value = cardId;
  selectedFromPlayerId.value = undefined;
}

function chooseTable(cardId: string, playerId: string) {
  selectedSource.value = 'table';
  selectedCardId.value = cardId;
  selectedFromPlayerId.value = playerId;
}

function submit() {
  emit('scout', {
    source: selectedSource.value,
    side: selectedSide.value,
    cardId: selectedCardId.value,
    fromPlayerId: selectedFromPlayerId.value,
  });
}
</script>

<template>
  <div class="ui-overlay">
    <section class="ui-dialog max-w-3xl text-left">
      <div class="mb-5 flex items-center justify-between">
        <div>
          <h2 class="text-2xl font-black text-foreground">Scout a card</h2>
          <p class="text-sm text-muted">
            Take one face-up card and add it to either end of your row.
          </p>
        </div>
        <button class="ui-btn-ghost" type="button" @click="emit('close')">✕</button>
      </div>

      <div class="space-y-5">
        <section>
          <h3 class="ui-section-label mb-2">Show pile</h3>
          <div class="flex gap-2 overflow-x-auto rounded-xl border border-border bg-card p-3">
            <button
              v-for="card in room.showPile"
              :key="card.id"
              type="button"
              class="rounded-xl"
              @click="chooseShowPile(card.id)"
            >
              <Card
                :card="card"
                :selected="selectedSource === 'showPile' && selectedCardId === card.id"
                compact
              />
            </button>
            <p v-if="room.showPile.length === 0" class="text-sm text-muted">
              No show-pile cards remain.
            </p>
          </div>
        </section>

        <section>
          <h3 class="ui-section-label mb-2">Table cards</h3>
          <div class="flex gap-2 overflow-x-auto rounded-xl border border-border bg-card p-3">
            <button
              v-for="item in tableCards"
              :key="item.card.id"
              type="button"
              class="rounded-xl"
              @click="chooseTable(item.card.id, item.playerId)"
            >
              <Card
                :card="item.card"
                :selected="selectedSource === 'table' && selectedCardId === item.card.id"
                compact
              />
              <span class="mt-1 block text-center text-xs text-muted">{{
                playerName(item.playerId)
              }}</span>
            </button>
            <p v-if="tableCards.length === 0" class="text-sm text-muted">
              No table cards available.
            </p>
          </div>
        </section>

        <div class="flex flex-wrap items-center gap-3">
          <span class="text-sm font-semibold text-muted">Add to</span>
          <button
            class="ui-btn-secondary"
            :class="selectedSide === 'left' ? 'border-scout text-scout' : ''"
            type="button"
            @click="selectedSide = 'left'"
          >
            Left end
          </button>
          <button
            class="ui-btn-secondary"
            :class="selectedSide === 'right' ? 'border-scout text-scout' : ''"
            type="button"
            @click="selectedSide = 'right'"
          >
            Right end
          </button>
        </div>

        <button class="ui-btn-primary btn-scout w-full" type="button" @click="submit">
          Confirm scout
        </button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.btn-scout {
  background: linear-gradient(135deg, var(--color-scout) 0%, #22d3ee 100%);
}
</style>
