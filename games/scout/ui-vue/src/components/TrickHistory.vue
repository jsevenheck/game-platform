<script setup lang="ts">
import type { RoomView } from '@shared/types';

defineProps<{ room: RoomView }>();

function playerName(room: RoomView, playerId: string): string {
  return room.players.find((player) => player.id === playerId)?.name ?? 'Player';
}
</script>

<template>
  <section class="ui-panel">
    <h2 class="mb-3 text-lg font-bold">Trick history</h2>
    <ol class="space-y-2">
      <li
        v-for="entry in room.trickHistory.slice(0, 6)"
        :key="entry.trickNumber"
        class="rounded-lg border border-border bg-card p-3 text-sm"
      >
        <span class="font-semibold text-foreground">#{{ entry.trickNumber }}</span>
        <span class="text-muted"> won by </span>
        <span class="text-scout">{{ playerName(room, entry.winnerId) }}</span>
        <span class="text-muted"> · {{ entry.cardCount }} cards · {{ entry.points }} pts</span>
      </li>
      <li v-if="room.trickHistory.length === 0" class="text-sm text-muted">
        No tricks collected yet.
      </li>
    </ol>
  </section>
</template>
