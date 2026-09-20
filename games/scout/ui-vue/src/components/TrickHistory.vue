<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import type { RoomView } from '@shared/types';

defineProps<{ room: RoomView }>();
const { t } = useI18n();

function playerName(room: RoomView, playerId: string): string {
  return room.players.find((player) => player.id === playerId)?.name ?? t('scout.playerFallback');
}
</script>

<template>
  <section class="ui-panel">
    <h2 class="mb-3 text-lg font-bold">{{ t('scout.history.takenSets') }}</h2>
    <ol class="space-y-2">
      <li
        v-for="entry in room.trickHistory.slice(0, 6)"
        :key="`${entry.trickNumber}-${entry.winnerId}`"
        class="rounded-lg border border-border bg-card p-3 text-sm"
      >
        <span class="font-semibold text-foreground">#{{ entry.trickNumber }}</span>
        <span class="text-muted"> {{ t('scout.history.takenBy') }} </span>
        <span class="text-scout">{{ playerName(room, entry.winnerId) }}</span>
        <span class="text-muted">
          · {{ t('scout.history.cardPoints', { count: entry.cardCount }) }}</span
        >
      </li>
      <li v-if="room.trickHistory.length === 0" class="text-sm text-muted">
        {{ t('scout.history.noneTaken') }}
      </li>
    </ol>

    <h2 class="mb-3 mt-5 text-lg font-bold">{{ t('scout.history.rounds') }}</h2>
    <ol class="space-y-2">
      <li
        v-for="entry in room.roundHistory.slice(0, 4)"
        :key="entry.roundNumber"
        class="rounded-lg border border-border bg-card p-3 text-sm"
      >
        <span class="font-semibold text-foreground">{{
          t('scout.history.round', { round: entry.roundNumber })
        }}</span>
        <span class="text-muted"> {{ t('scout.history.endedBy') }} </span>
        <span class="text-scout">{{ playerName(room, entry.endingPlayerId) }}</span>
        <span class="text-muted"> · {{ t(`scout.history.reasons.${entry.reason}`) }}</span>
      </li>
      <li v-if="room.roundHistory.length === 0" class="text-sm text-muted">
        {{ t('scout.history.noRounds') }}
      </li>
    </ol>
  </section>
</template>
