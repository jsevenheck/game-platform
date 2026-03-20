<script setup lang="ts">
import { computed } from 'vue';
import { TEAM_HEX_BY_COLOR, TEAM_NAME_BY_COLOR } from '@shared/constants';
import type { PlayerView } from '@shared/types';
import { useGameStore } from '../stores/game';
import GameBoard from './GameBoard.vue';

const store = useGameStore();

defineEmits<{
  restart: [];
}>();

const isHost = computed(
  () => store.room?.players.find((p: PlayerView) => p.id === store.playerId)?.isHost ?? false
);

const winningLabel = computed(() => {
  const winners = store.room?.winningTeams ?? [];
  if (winners.length === 0) return null;
  return winners.map((team) => TEAM_NAME_BY_COLOR[team]).join(', ');
});
</script>

<template>
  <div class="game-over">
    <h1 class="title">Game Over!</h1>

    <div v-if="store.room?.winningTeams.length" class="winner-section">
      <p class="winner-label">{{ store.room.winningTeams.length === 1 ? 'Winner' : 'Winners' }}</p>
      <h2
        class="winner-name"
        :style="{
          color:
            store.room.winningTeams.length === 1
              ? TEAM_HEX_BY_COLOR[store.room.winningTeams[0]]
              : '#fff',
        }"
      >
        {{ winningLabel }}
        {{ store.room.winningTeams.length === 1 ? 'Team' : '' }}
      </h2>
    </div>

    <div class="final-board">
      <h3>Final Board</h3>
      <GameBoard />
    </div>

    <div class="team-results">
      <div
        v-for="team in store.room?.teams"
        :key="team.color"
        class="team-result"
        :class="{ eliminated: team.eliminated }"
      >
        <span class="team-dot" :style="{ backgroundColor: TEAM_HEX_BY_COLOR[team.color] }" />
        <span class="team-name">{{ TEAM_NAME_BY_COLOR[team.color] }}</span>
        <span class="team-score-result">{{ team.revealedCount }} / {{ team.targetCount }}</span>
        <span v-if="team.eliminated" class="eliminated-badge">Eliminated</span>
      </div>
    </div>

    <button v-if="isHost" class="btn btn-primary" @click="$emit('restart')">Play Again</button>
    <p v-else class="hint">Waiting for host to restart...</p>
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
  font-weight: 700;
}

.final-board {
  width: 100%;
  max-width: 720px;
}

.final-board h3 {
  color: #a1a1aa;
  text-align: center;
  margin-bottom: 1rem;
}

.team-results {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  width: 100%;
  max-width: 320px;
}

.team-result {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.6rem 0.75rem;
  background: #27272a;
  border-radius: 6px;
}

.team-result.eliminated {
  opacity: 0.5;
}

.team-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
}

.team-name {
  flex: 1;
  color: #fff;
  font-weight: 600;
}

.team-score-result {
  color: #8b5cf6;
  font-weight: 700;
}

.eliminated-badge {
  font-size: 0.7rem;
  color: #ef4444;
  text-transform: uppercase;
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
