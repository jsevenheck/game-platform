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
  <header class="header">
    <div class="left">
      <span class="room-code">{{ store.roomCode }}</span>
    </div>
    <div class="center">
      <span
        v-if="store.phase === 'playing' || store.phase === 'roundEnd'"
        class="round-info"
      >
        {{ roundDisplay() }}
      </span>
    </div>
    <div class="right">
      <button
        class="btn-leave"
        @click="$emit('leave')"
      >
        Leave
      </button>
    </div>
  </header>
</template>

<style scoped>
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  background: #18181b;
  border-bottom: 1px solid #27272a;
}

.room-code {
  color: #8b5cf6;
  font-weight: 700;
  font-size: 0.875rem;
  letter-spacing: 0.15em;
}

.round-info {
  color: #a1a1aa;
  font-size: 0.875rem;
}

.btn-leave {
  background: transparent;
  border: 1px solid #3f3f46;
  color: #71717a;
  padding: 0.35rem 0.75rem;
  border-radius: 6px;
  font-size: 0.8rem;
  cursor: pointer;
}

.btn-leave:hover {
  border-color: #ef4444;
  color: #ef4444;
}
</style>
