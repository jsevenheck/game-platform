<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { useGameStore } from '../stores/game';
import CardCell from './CardCell.vue';

const store = useGameStore();
const { t } = useI18n();
withDefaults(defineProps<{ disabled?: boolean }>(), { disabled: false });

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
  <div class="signals-board" :aria-label="t('secret-signals.play.board')">
    <CardCell
      v-for="(card, index) in store.board"
      :key="index"
      :data-card-index="index"
      :card="card"
      :clickable="store.canGuess && !card.revealed"
      :pending="disabled"
      :is-director-view="store.isDirector || store.room?.phase === 'ended'"
      :is-focused="focusedPlayers(index).length > 0"
      :focused-by-name="focusedLabel(index)"
      :focused-by-color="store.room?.currentTurnTeam ?? null"
      @select="$emit('card-press', index)"
    />
  </div>
</template>

<style scoped>
.signals-board {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: clamp(0.3rem, 1.2vw, 0.65rem);
  width: 100%;
  max-width: 58rem;
  min-width: 0;
  margin-inline: auto;
}
</style>
