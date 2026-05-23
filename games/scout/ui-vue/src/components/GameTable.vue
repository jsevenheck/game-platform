<script setup lang="ts">
import { computed, shallowRef } from 'vue';
import { useGameStore } from '../stores/game';
import Card from './Card.vue';
import PlayControls from './PlayControls.vue';
import ScoutDialog from './ScoutDialog.vue';
import TrickHistory from './TrickHistory.vue';

const emit = defineEmits<{
  playCards: [payload: { startIndex: number; count: number }];
  scout: [
    payload: {
      source: 'showPile' | 'table';
      side: 'left' | 'right';
      cardId?: string;
      fromPlayerId?: string;
    },
  ];
}>();

const store = useGameStore();
const scoutDialogOpen = shallowRef(false);

const room = computed(() => store.room);
const currentTurnName = computed(() => {
  const playerId = room.value?.trick?.currentTurnPlayerId;
  return room.value?.players.find((player) => player.id === playerId)?.name ?? '—';
});
const currentPlay = computed(() => room.value?.trick?.currentPlay ?? null);

function playerName(playerId: string): string {
  return room.value?.players.find((player) => player.id === playerId)?.name ?? 'Player';
}

function handleScout(payload: {
  source: 'showPile' | 'table';
  side: 'left' | 'right';
  cardId?: string;
  fromPlayerId?: string;
}) {
  scoutDialogOpen.value = false;
  emit('scout', payload);
}
</script>

<template>
  <main
    v-if="room"
    class="mx-auto grid min-h-dvh max-w-7xl gap-5 p-4 lg:grid-cols-[1fr_320px] lg:p-6"
  >
    <section class="space-y-5">
      <header class="ui-panel flex flex-wrap items-center justify-between gap-3">
        <div>
          <p class="text-sm font-semibold uppercase tracking-[0.3em] text-scout">
            Trick {{ room.trick?.trickNumber ?? 1 }}
          </p>
          <h1 class="text-2xl font-black text-foreground">
            {{ store.isMyTurn ? 'Your turn' : `${currentTurnName}'s turn` }}
          </h1>
        </div>
        <div class="flex gap-2 text-sm text-muted">
          <span class="ui-badge">Show pile: {{ room.showPile.length }}</span>
          <span class="ui-badge">Taken: {{ store.self?.takenCount ?? 0 }}</span>
        </div>
      </header>

      <section class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <article
          v-for="player in room.players"
          :key="player.id"
          class="rounded-xl border bg-panel p-4"
          :class="player.id === room.trick?.currentTurnPlayerId ? 'border-scout' : 'border-border'"
        >
          <div class="mb-3 flex items-center justify-between">
            <h2 class="font-bold text-foreground">
              {{ player.name }}<span v-if="player.id === store.playerId"> (you)</span>
            </h2>
            <span class="text-xs text-muted">{{ player.rowCount }} in row</span>
          </div>
          <div class="flex -space-x-8 overflow-hidden py-2">
            <Card
              v-for="index in Math.min(player.rowCount, 8)"
              :key="`${player.id}-${index}`"
              :card="player.row?.[index - 1] ?? null"
              :face-down="player.id !== store.playerId"
              compact
            />
          </div>
          <p class="mt-2 text-xs text-muted">{{ player.takenCount }} cards taken</p>
        </article>
      </section>

      <section class="ui-panel min-h-52">
        <div class="mb-4 flex items-center justify-between">
          <h2 class="text-lg font-bold">Table</h2>
          <p v-if="currentPlay" class="text-sm text-muted">
            Beat sum {{ currentPlay.sum }} · {{ currentPlay.count }} cards · high
            {{ currentPlay.highCard }}
          </p>
        </div>
        <div class="grid gap-3 md:grid-cols-2">
          <article
            v-for="play in room.trick?.plays ?? []"
            :key="play.id"
            class="rounded-xl border border-border bg-card p-3"
          >
            <div class="mb-2 flex justify-between text-sm">
              <span class="font-semibold text-foreground">{{ playerName(play.playerId) }}</span>
              <span class="text-muted"
                >{{ play.sum }} / {{ play.count }} / {{ play.highCard }}</span
              >
            </div>
            <div class="flex gap-2 overflow-x-auto">
              <Card v-for="card in play.cards" :key="card.id" :card="card" compact />
            </div>
          </article>
          <p v-if="(room.trick?.plays.length ?? 0) === 0" class="text-muted">
            Leader chooses the opening run.
          </p>
        </div>
      </section>

      <PlayControls
        :current-play="currentPlay"
        @play-cards="emit('playCards', $event)"
        @scout="scoutDialogOpen = true"
      />
    </section>

    <aside class="space-y-5">
      <section class="ui-panel">
        <h2 class="mb-3 text-lg font-bold">Show pile</h2>
        <div class="flex flex-wrap gap-2">
          <Card v-for="card in room.showPile.slice(0, 4)" :key="card.id" :card="card" compact />
          <p v-if="room.showPile.length === 0" class="text-sm text-muted">Empty</p>
        </div>
      </section>
      <TrickHistory :room="room" />
    </aside>

    <ScoutDialog
      v-if="scoutDialogOpen"
      :room="room"
      @close="scoutDialogOpen = false"
      @scout="handleScout"
    />
  </main>
</template>
