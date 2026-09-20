<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useGameStore } from '../stores/game';
import { FLIP7_BONUS } from '@shared/constants';

const { t } = useI18n();
const store = useGameStore();

const lastRound = computed(() => {
  const history = store.room?.roundHistory ?? [];
  return history[history.length - 1] ?? null;
});

const flip7PlayerId = computed(() => lastRound.value?.flip7PlayerId ?? null);

const rows = computed(() => {
  if (!lastRound.value || !store.room) return [];
  return store.room.players.map((p) => ({
    id: p.id,
    name: p.name,
    isMe: p.id === store.playerId,
    earned: lastRound.value!.scores[p.id] ?? 0,
    total: p.totalScore,
    wasFlip7: flip7PlayerId.value === p.id,
  }));
});
</script>

<template>
  <div class="flex min-h-dvh flex-col items-center justify-center gap-6 p-6">
    <div class="text-center">
      <p class="text-xl font-bold text-foreground">
        <template v-if="flip7PlayerId">🃏 {{ t('flip7.round.flip7') }}</template>
        <template v-else>{{ t('flip7.round.over') }}</template>
      </p>
      <p class="mt-1 text-sm text-muted-foreground">
        {{ t('flip7.round.nextSoon') }}
      </p>
    </div>

    <div class="ui-panel w-full max-w-md">
      <p class="ui-section-label mb-3">
        {{ t('flip7.round.results', { round: lastRound?.roundNumber }) }}
      </p>
      <div class="space-y-2">
        <div
          v-for="row in rows"
          :key="row.id"
          class="flex items-center justify-between rounded-sm px-3 py-2"
          :class="row.isMe ? 'bg-flip7-muted' : 'bg-elevated'"
        >
          <span class="text-sm font-medium" :class="row.isMe ? 'text-flip7' : 'text-foreground'">
            {{ row.name }}
            <span v-if="row.wasFlip7" class="ml-1">🃏</span>
          </span>
          <div class="flex items-center gap-3 text-sm">
            <span class="text-muted-foreground">
              +{{ row.earned }}
              <span v-if="row.wasFlip7" class="text-xs text-flip7">{{
                t('flip7.round.bonus', { bonus: FLIP7_BONUS })
              }}</span>
            </span>
            <span class="font-bold text-foreground">{{ row.total }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
