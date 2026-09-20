<script setup lang="ts">
import { computed, shallowRef } from 'vue';
import { useI18n } from 'vue-i18n';
import { useGameStore } from '../stores/game';
import Card from './Card.vue';
import PlayControls from './PlayControls.vue';
import ScoutDialog from './ScoutDialog.vue';
import TrickHistory from './TrickHistory.vue';

const emit = defineEmits<{
  playCards: [payload: { startIndex: number; count: number }];
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
const scoutDialogOpen = shallowRef(false);

const room = computed(() => store.room);
const currentTurnName = computed(() => {
  const playerId = room.value?.trick?.currentTurnPlayerId;
  return room.value?.players.find((player) => player.id === playerId)?.name ?? '—';
});
const currentPlay = computed(() => room.value?.trick?.currentPlay ?? null);

function playerName(playerId: string): string {
  return (
    room.value?.players.find((player) => player.id === playerId)?.name ?? t('scout.playerFallback')
  );
}

function handleScout(payload: {
  cardId: string;
  insertIndex: number;
  flip?: boolean;
  thenPlay?: { startIndex: number; count: number };
}) {
  scoutDialogOpen.value = false;
  emit('scout', payload);
}
</script>

<template>
  <main
    v-if="room"
    class="mx-auto grid max-w-7xl gap-4 p-3 sm:pt-14 lg:grid-cols-[1fr_280px] lg:p-4 lg:pt-14"
  >
    <section class="space-y-5">
      <header class="ui-panel flex flex-wrap items-center justify-between gap-3">
        <div>
          <p class="text-sm font-semibold uppercase tracking-[0.3em] text-scout">
            {{
              t('scout.table.roundTurn', {
                round: room.roundNumber,
                total: room.totalRounds,
                turn: room.trick?.trickNumber ?? 1,
              })
            }}
          </p>
          <h1 class="text-2xl font-black text-foreground">
            {{
              store.isMyTurn
                ? t('scout.table.yourTurn')
                : t('scout.table.turnOf', { name: currentTurnName })
            }}
          </h1>
        </div>
        <div class="flex flex-wrap gap-2 text-sm text-muted">
          <span class="ui-badge">{{
            t('scout.table.taken', { count: store.self?.takenCount ?? 0 })
          }}</span>
          <span class="ui-badge">{{
            t('scout.table.scoutTokens', { count: store.self?.scoutTokens ?? 0 })
          }}</span>
          <span class="ui-badge">{{
            t('scout.table.scoutAndShow', { count: store.self?.scoutAndShowTokens ?? 0 })
          }}</span>
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
              {{ player.name
              }}<span v-if="player.id === store.playerId" class="ml-1">{{ t('scout.you') }}</span>
            </h2>
            <span class="text-xs text-muted">{{
              t('scout.table.inRow', { count: player.rowCount })
            }}</span>
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
          <p class="mt-2 text-xs text-muted">
            {{
              t('scout.table.playerStats', {
                taken: player.takenCount,
                tokens: player.scoutTokens,
                score: player.score,
              })
            }}
          </p>
        </article>
      </section>

      <section class="ui-panel min-h-28">
        <div class="mb-4 flex items-center justify-between">
          <h2 class="text-lg font-bold">{{ t('scout.table.priorSet') }}</h2>
          <p v-if="currentPlay" class="text-sm text-muted">
            {{
              t('scout.table.beat', {
                kind: t(`scout.kinds.${currentPlay.kind}`),
                count: t('scout.cards', { count: currentPlay.count }, currentPlay.count),
                low: currentPlay.lowCard,
                high: currentPlay.highCard,
              })
            }}
          </p>
        </div>
        <div>
          <article v-if="currentPlay" class="rounded-xl border border-border bg-card p-3">
            <div class="mb-2 flex justify-between text-sm">
              <span class="font-semibold text-foreground">{{
                playerName(currentPlay.playerId)
              }}</span>
              <span class="text-muted">
                {{
                  t('scout.table.priorSetSummary', {
                    kind: t(`scout.kinds.${currentPlay.kind}`),
                    count: currentPlay.count,
                    low: currentPlay.lowCard,
                  })
                }}
              </span>
            </div>
            <div class="flex gap-2 overflow-x-auto">
              <Card v-for="card in currentPlay.cards" :key="card.id" :card="card" compact />
            </div>
          </article>
          <p v-else class="text-muted">{{ t('scout.table.leaderOpens') }}</p>
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
        <h2 class="mb-3 text-lg font-bold">{{ t('scout.table.roundScoring') }}</h2>
        <p class="text-sm text-muted">
          {{ t('scout.table.scoringRules') }}
        </p>
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
