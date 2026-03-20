<script setup lang="ts">
import { computed } from 'vue';
import type { PlayerView } from '@shared/types';
import { useGameStore } from '../stores/game';

const store = useGameStore();

defineEmits<{
  restart: [];
}>();

const isHost = computed(
  () => store.room?.players.find((p: PlayerView) => p.id === store.playerId)?.isHost ?? false
);

const sortedPlayers = computed(() => {
  if (!store.room) return [];
  return [...store.room.players].sort((a, b) => b.score - a.score);
});

const topScore = computed(() => sortedPlayers.value[0]?.score ?? 0);

const winners = computed(() =>
  sortedPlayers.value.filter((p: PlayerView) => p.score === topScore.value)
);

const singleWinner = computed(() =>
  winners.value.length === 1 ? (winners.value[0] ?? null) : null
);
</script>

<template>
  <div class="game-over">
    <h1 class="title">🏆 Game Over!</h1>

    <div class="winner-section">
      <template v-if="singleWinner">
        <p class="winner-label">Champion</p>
        <h2 class="winner-name">{{ singleWinner.name }}</h2>
      </template>
      <template v-else>
        <p class="winner-label">Tied!</p>
        <h2 class="winner-name">{{ winners.map((w) => w.name).join(' & ') }}</h2>
      </template>
      <p class="winner-score">{{ topScore }} points</p>
      <p class="winner-target">Target score: {{ store.room?.targetScore ?? 0 }}</p>
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

    <!-- Round history -->
    <div v-if="store.room?.roundHistory.length" class="round-history">
      <h3>Round History</h3>
      <div
        v-for="(round, index) in store.room.roundHistory"
        :key="index"
        class="history-row"
        :class="round.winner"
      >
        <span class="history-round">R{{ index + 1 }}</span>
        <span class="history-word">{{ round.secretWord }}</span>
        <span class="history-winner">
          {{ round.winner === 'civilians' ? '👥' : '🕵️' }}
        </span>
      </div>
    </div>

    <button v-if="isHost" class="btn btn-primary" @click="$emit('restart')">🔄 Play Again</button>
    <p v-else class="hint">Waiting for host to restart...</p>
  </div>
</template>

<style scoped>
.game-over {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
  padding: 2rem 1rem;
  min-height: 100dvh;
  background: linear-gradient(135deg, #0f0f23 0%, #1a1a2e 50%, #16213e 100%);
}

.title {
  font-size: 2.5rem;
  font-weight: 900;
  background: linear-gradient(135deg, #f97316, #ef4444, #ec4899);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.winner-section {
  text-align: center;
}

.winner-label {
  color: #64748b;
  text-transform: uppercase;
  font-size: 0.85rem;
  letter-spacing: 0.15em;
}

.winner-name {
  font-size: 2rem;
  color: #f97316;
  font-weight: 800;
  margin: 0.25rem 0;
}

.winner-score {
  color: #94a3b8;
  font-size: 1.15rem;
}

.winner-target {
  color: #64748b;
  font-size: 0.85rem;
  margin-top: 0.35rem;
}

.final-scores {
  width: 100%;
  max-width: 340px;
}

.final-scores h3 {
  color: #94a3b8;
  margin-bottom: 0.75rem;
  text-align: center;
  font-size: 0.95rem;
}

.score-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.65rem 0.85rem;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  margin-bottom: 0.5rem;
}

.score-row.winner {
  border-color: rgba(249, 115, 22, 0.4);
  background: rgba(249, 115, 22, 0.08);
}

.rank {
  color: #64748b;
  font-weight: 700;
  min-width: 2rem;
}

.name {
  flex: 1;
  color: #e2e8f0;
  font-weight: 500;
}

.score {
  color: #f97316;
  font-weight: 800;
  font-size: 1.2rem;
}

.round-history {
  width: 100%;
  max-width: 340px;
}

.round-history h3 {
  color: #94a3b8;
  margin-bottom: 0.75rem;
  text-align: center;
  font-size: 0.95rem;
}

.history-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 0.75rem;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 8px;
  margin-bottom: 0.35rem;
}

.history-row.civilians {
  border-left: 3px solid #22c55e;
}

.history-row.infiltrators {
  border-left: 3px solid #ef4444;
}

.history-round {
  color: #64748b;
  font-size: 0.8rem;
  font-weight: 700;
  min-width: 2rem;
}

.history-word {
  flex: 1;
  color: #e2e8f0;
  font-size: 0.9rem;
}

.history-winner {
  font-size: 1.1rem;
}

.btn {
  padding: 1rem 2.5rem;
  border: none;
  border-radius: 12px;
  font-size: 1.1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s;
}

.btn-primary {
  background: linear-gradient(135deg, #f97316, #ef4444);
  color: #fff;
  box-shadow: 0 4px 15px rgba(249, 115, 22, 0.3);
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 25px rgba(249, 115, 22, 0.4);
}

.hint {
  color: #64748b;
  font-style: italic;
}
</style>
