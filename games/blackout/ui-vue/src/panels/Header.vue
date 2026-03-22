<script setup lang="ts">
import { useGameStore } from '../stores/game';

const store = useGameStore();

defineEmits<{
  leave: [];
}>();

function roundDisplay(): string {
  const round = store.currentRound;
  if (!round) return '';
  return `Round ${round.roundNumber}/${store.room?.maxRounds ?? 0}`;
}
</script>

<template>
  <header class="blackout-header ui-shell-header">
    <span class="text-sm font-bold tracking-[0.15em] text-blackout">{{ store.roomCode }}</span>
    <span v-if="store.phase === 'playing' || store.phase === 'roundEnd'" class="text-sm text-muted">
      {{ roundDisplay() }}
    </span>
    <button
      class="ui-btn-ghost rounded-[--radius-sm] border border-border-strong px-3 py-1 text-xs hover:border-danger hover:text-danger"
      @click="$emit('leave')"
    >
      Leave
    </button>
  </header>
</template>
