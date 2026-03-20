<script setup lang="ts">
import { useGameStore } from '../stores/game';
import CardCell from './CardCell.vue';

const store = useGameStore();

defineEmits<{
  'card-press': [cardIndex: number];
}>();

function focusedPlayers(index: number) {
  const markers = (store.room?.focusedCards ?? []).filter((marker) => marker.cardIndex === index);
  return markers
    .map((marker) => store.room?.players.find((player) => player.id === marker.playerId) ?? null)
    .filter((player): player is NonNullable<typeof player> => player !== null);
}

function focusedLabel(index: number): string | null {
  const players = focusedPlayers(index);
  if (players.length === 0) return null;
  if (players.length === 1) return players[0].name;
  if (players.length === 2) return `${players[0].name} + ${players[1].name}`;
  return `${players[0].name} +${players.length - 1}`;
}
</script>

<template>
  <div class="game-board">
    <CardCell
      v-for="(card, index) in store.board"
      :key="index"
      :data-card-index="index"
      :card="card"
      :clickable="store.canGuess && !card.revealed"
      :is-director-view="store.isDirector"
      :is-focused="focusedPlayers(index).length > 0"
      :focused-by-name="focusedLabel(index)"
      :focused-by-color="store.room?.currentTurnTeam ?? null"
      @select="$emit('card-press', index)"
    />
  </div>
</template>

<style scoped>
.game-board {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 0.5rem;
  max-width: 720px;
  width: 100%;
  margin: 0 auto;
}

@media (max-width: 480px) {
  .game-board {
    gap: 0.25rem;
  }
}
</style>
