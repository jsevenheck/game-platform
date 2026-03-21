<script setup lang="ts">
import { useGameStore } from '../stores/game';
import { computed } from 'vue';

const store = useGameStore();

const sortedPlayers = computed(() => {
  if (!store.room) return [];
  return [...store.room.players].sort((a, b) => b.score - a.score);
});

const lastResult = computed(() => {
  if (!store.room) return null;
  const history = store.room.roundHistory;
  return history.length > 0 ? history[history.length - 1] : null;
});

const winnerName = computed(() => {
  if (!lastResult.value?.winnerId) return null;
  return store.room?.players.find((p) => p.id === lastResult.value!.winnerId)?.name;
});
</script>

<template>
  <div class="scoreboard">
    <h2>Round {{ lastResult?.roundNumber }} Complete!</h2>

    <div
      v-if="winnerName"
      class="winner-banner"
    >
      {{ winnerName }} got it right!
    </div>
    <div
      v-else
      class="skip-banner"
    >
      Round skipped - no correct answer
    </div>

    <div class="scores">
      <div
        v-for="(player, index) in sortedPlayers"
        :key="player.id"
        class="score-row"
        :class="{ leading: index === 0 }"
      >
        <span class="rank">#{{ index + 1 }}</span>
        <span class="name">{{ player.name }}</span>
        <span class="score">{{ player.score }}</span>
      </div>
    </div>

    <p class="next-round">
      Next round starting...
    </p>
  </div>
</template>

<style scoped>
.scoreboard {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
  padding: 2rem 1rem;
}

h2 {
  color: #d4d4d8;
}

.winner-banner {
  background: linear-gradient(135deg, #8b5cf6, #6d28d9);
  color: #fff;
  padding: 0.75rem 2rem;
  border-radius: 8px;
  font-size: 1.25rem;
  font-weight: 600;
}

.skip-banner {
  background: #3f3f46;
  color: #a1a1aa;
  padding: 0.75rem 2rem;
  border-radius: 8px;
}

.scores {
  width: 100%;
  max-width: 320px;
}

.score-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.6rem 0.75rem;
  background: #27272a;
  border-radius: 6px;
  margin-bottom: 0.5rem;
}

.score-row.leading {
  border: 2px solid #8b5cf6;
}

.rank {
  color: #71717a;
  font-weight: 600;
  min-width: 2rem;
}

.name {
  flex: 1;
  color: #fff;
}

.score {
  color: #8b5cf6;
  font-weight: 700;
  font-size: 1.25rem;
}

.next-round {
  color: #71717a;
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.4;
  }
}
</style>
