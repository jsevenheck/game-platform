<script setup lang="ts">
import type { RoomView } from '@shared/types';

defineProps<{ room: RoomView }>();

function playerName(room: RoomView, playerId: string): string {
  return room.players.find((player) => player.id === playerId)?.name ?? 'Player';
}
</script>

<template>
  <section class="ui-panel">
    <h2 class="mb-3 text-lg font-bold">Taken prior sets</h2>
    <ol class="space-y-2">
      <li
        v-for="entry in room.trickHistory.slice(0, 6)"
        :key="`${entry.trickNumber}-${entry.winnerId}`"
        class="rounded-lg border border-border bg-card p-3 text-sm"
      >
        <span class="font-semibold text-foreground">#{{ entry.trickNumber }}</span>
        <span class="text-muted"> taken by </span>
        <span class="text-scout">{{ playerName(room, entry.winnerId) }}</span>
        <span class="text-muted"> · {{ entry.cardCount }} card point(s)</span>
      </li>
      <li v-if="room.trickHistory.length === 0" class="text-sm text-muted">
        No prior sets taken yet.
      </li>
    </ol>

    <h2 class="mb-3 mt-5 text-lg font-bold">Round history</h2>
    <ol class="space-y-2">
      <li
        v-for="entry in room.roundHistory.slice(0, 4)"
        :key="entry.roundNumber"
        class="rounded-lg border border-border bg-card p-3 text-sm"
      >
        <span class="font-semibold text-foreground">Round {{ entry.roundNumber }}</span>
        <span class="text-muted"> ended by </span>
        <span class="text-scout">{{ playerName(room, entry.endingPlayerId) }}</span>
        <span class="text-muted"> · {{ entry.reason }}</span>
      </li>
      <li v-if="room.roundHistory.length === 0" class="text-sm text-muted">
        No completed rounds yet.
      </li>
    </ol>
  </section>
</template>
