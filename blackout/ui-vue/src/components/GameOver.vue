<script setup lang="ts">
import { useGameStore } from '../stores/game';
import { computed } from 'vue';

const store = useGameStore();

defineEmits<{
  restart: [];
}>();

const sortedPlayers = computed(() => {
  if (!store.room) return [];
  return [...store.room.players].sort((a, b) => b.score - a.score);
});

const topScore = computed(() => sortedPlayers.value[0]?.score ?? 0);

const winners = computed(() => {
  return sortedPlayers.value.filter((p) => p.score === topScore.value);
});
</script>

<template>
  <div class="game-over">
    <h1 class="title">
      Game Over!
    </h1>

    <div class="winner-section">
      <template v-if="winners.length === 1">
        <p class="winner-label">
          Winner
        </p>
        <h2 class="winner-name">
          {{ winners[0]?.name }}
        </h2>
      </template>
      <template v-else>
        <p class="winner-label">
          Tie!
        </p>
        <h2 class="winner-name">
          {{ winners.map((w) => w.name).join(' & ') }}
        </h2>
      </template>
      <p class="winner-score">
        {{ topScore }} points
      </p>
    </div>

    <div class="final-scores">
      <h3>Final Scores</h3>
      <div
        v-for="(player, index) in sortedPlayers"
        :key="player.id"
        class="score-row"
        :class="{ winner: player.score === topScore }"
      >
        <span class="rank">#{{ index + 1 }}</span>
        <span class="name">{{ player.name }}</span>
        <span class="score">{{ player.score }}</span>
      </div>
    </div>

    <button
      v-if="store.isHost"
      class="btn btn-primary"
      @click="$emit('restart')"
    >
      Play Again
    </button>
    <p
      v-else
      class="hint"
    >
      Waiting for host to restart...
    </p>
  </div>
</template>

<style scoped>
.game-over {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2rem;
  padding: 2rem 1rem;
}

.title {
  font-size: 2.5rem;
  font-weight: 900;
  color: #fff;
}

.winner-section {
  text-align: center;
}

.winner-label {
  color: #a1a1aa;
  text-transform: uppercase;
  font-size: 0.875rem;
  letter-spacing: 0.1em;
}

.winner-name {
  font-size: 2rem;
  color: #8b5cf6;
  font-weight: 700;
}

.winner-score {
  color: #d4d4d8;
  font-size: 1.25rem;
}

.final-scores {
  width: 100%;
  max-width: 320px;
}

.final-scores h3 {
  color: #a1a1aa;
  margin-bottom: 0.75rem;
  text-align: center;
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

.score-row.winner {
  border: 2px solid #8b5cf6;
  background: rgba(139, 92, 246, 0.1);
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

.btn {
  padding: 0.75rem 2rem;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
}

.btn-primary {
  background: #8b5cf6;
  color: #fff;
}

.btn-primary:hover {
  background: #7c3aed;
}

.hint {
  color: #71717a;
}
</style>
