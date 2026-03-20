<script setup lang="ts">
import { useGameStore } from '../stores/game';

const store = useGameStore();
</script>

<template>
  <aside class="players-panel">
    <h4>Players</h4>
    <div
      v-for="player in store.room?.players"
      :key="player.id"
      class="player"
      :class="{
        self: player.id === store.playerId,
        disconnected: !player.connected,
        reader: store.currentRound?.readerId === player.id,
      }"
    >
      <span class="name">{{ player.name }}</span>
      <span class="score">{{ player.score }}</span>
    </div>
  </aside>
</template>

<style scoped>
.players-panel {
  position: fixed;
  right: 1rem;
  top: 4rem;
  width: 160px;
  background: #1c1c1f;
  border: 1px solid #27272a;
  border-radius: 8px;
  padding: 0.75rem;
}

.players-panel h4 {
  color: #71717a;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin-bottom: 0.5rem;
}

.player {
  display: flex;
  justify-content: space-between;
  padding: 0.3rem 0.4rem;
  border-radius: 4px;
  margin-bottom: 0.25rem;
  font-size: 0.85rem;
}

.player.self {
  background: rgba(139, 92, 246, 0.15);
}

.player.disconnected {
  opacity: 0.4;
}

.player.reader .name {
  color: #fbbf24;
}

.name {
  color: #d4d4d8;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.score {
  color: #8b5cf6;
  font-weight: 700;
}

@media (max-width: 768px) {
  .players-panel {
    position: static;
    width: 100%;
    max-width: 320px;
    margin: 0 auto;
  }
}
</style>
