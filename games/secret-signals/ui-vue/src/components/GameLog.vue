<script setup lang="ts">
import { computed } from 'vue';
import { TEAM_HEX_BY_COLOR } from '@shared/constants';
import { useGameStore } from '../stores/game';
import { CARD_HEX_BY_TYPE } from '../lib/teamTheme';

const store = useGameStore();
const reversedLog = computed(() => [...(store.room?.log ?? [])].reverse());
</script>

<template>
  <div class="game-log">
    <h3 class="log-title">Signal Log</h3>
    <div v-if="reversedLog.length === 0" class="log-empty">No signals yet</div>
    <div class="log-entries">
      <div v-for="(entry, i) in reversedLog" :key="i" class="log-entry">
        <div class="log-header">
          <span class="team-dot" :style="{ backgroundColor: TEAM_HEX_BY_COLOR[entry.teamColor] }" />
          <span class="log-signal">{{ entry.signal.word }}</span>
          <span class="log-number">{{ entry.signal.number }}</span>
        </div>
        <div class="log-cards">
          <span
            v-for="(card, j) in entry.revealedCards"
            :key="j"
            class="log-card"
            :style="{ color: CARD_HEX_BY_TYPE[card.type] }"
          >
            {{ card.word }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.game-log {
  background: #1c1c1f;
  border-left: 1px solid #27272a;
  padding: 1rem;
  overflow-y: auto;
  max-height: 100%;
}

.log-title {
  color: #a1a1aa;
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin-bottom: 0.75rem;
}

.log-empty {
  color: #52525b;
  font-size: 0.8rem;
  font-style: italic;
}

.log-entries {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.log-entry {
  padding: 0.5rem;
  background: #27272a;
  border-radius: 6px;
}

.log-header {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin-bottom: 0.25rem;
}

.team-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.log-signal {
  color: #fff;
  font-weight: 600;
  font-size: 0.85rem;
  text-transform: uppercase;
}

.log-number {
  color: #8b5cf6;
  font-weight: 700;
  font-size: 0.85rem;
}

.log-cards {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem 0.5rem;
}

.log-card {
  font-size: 0.75rem;
  font-weight: 500;
}
</style>
