<script setup lang="ts">
import { TEAM_HEX_BY_COLOR, TEAM_NAME_BY_COLOR } from '@shared/constants';
import { useGameStore } from '../stores/game';

const store = useGameStore();
</script>

<template>
  <div class="turn-indicator">
    <div class="turn-info">
      <div
        v-if="store.room?.currentTurnTeam"
        class="team-badge"
        :style="{ backgroundColor: TEAM_HEX_BY_COLOR[store.room.currentTurnTeam] }"
      >
        {{ TEAM_NAME_BY_COLOR[store.room.currentTurnTeam] ?? store.room.currentTurnTeam }} Team
      </div>
      <span class="phase-label">
        {{
          store.room?.turnPhase === 'giving-signal'
            ? 'Director is thinking...'
            : 'Agents are guessing'
        }}
      </span>
    </div>

    <div
      v-if="store.room?.currentSignal && store.room.turnPhase === 'guessing'"
      class="signal-display"
    >
      <span class="signal-word">{{ store.room.currentSignal.word }}</span>
      <span class="signal-number">{{ store.room.currentSignal.number }}</span>
      <span class="guess-count">
        ({{ store.room.currentSignal.guessesUsed }} /
        {{
          store.room.currentSignal.number === 0 ? '\u221E' : store.room.currentSignal.number + 1
        }})
      </span>
    </div>

    <div class="team-progress">
      <div
        v-for="team in store.room?.teams"
        :key="team.color"
        class="team-stat"
        :class="{ eliminated: team.eliminated }"
      >
        <span class="team-dot" :style="{ backgroundColor: TEAM_HEX_BY_COLOR[team.color] }" />
        <span class="team-score">{{ team.revealedCount }}/{{ team.targetCount }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.turn-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1.5rem;
  padding: 0.75rem 1rem;
  background: #1c1c1f;
  border-bottom: 1px solid #27272a;
  flex-wrap: wrap;
}

.turn-info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.team-badge {
  padding: 0.3rem 0.75rem;
  border-radius: 6px;
  color: #fff;
  font-weight: 700;
  font-size: 0.85rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.phase-label {
  color: #a1a1aa;
  font-size: 0.85rem;
}

.signal-display {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.4rem 0.75rem;
  background: #27272a;
  border-radius: 6px;
}

.signal-word {
  color: #fff;
  font-weight: 700;
  font-size: 1rem;
  text-transform: uppercase;
}

.signal-number {
  color: #8b5cf6;
  font-weight: 700;
  font-size: 1.1rem;
}

.guess-count {
  color: #71717a;
  font-size: 0.8rem;
}

.team-progress {
  display: flex;
  gap: 0.75rem;
}

.team-stat {
  display: flex;
  align-items: center;
  gap: 0.3rem;
}

.team-stat.eliminated {
  opacity: 0.3;
  text-decoration: line-through;
}

.team-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.team-score {
  color: #d4d4d8;
  font-size: 0.8rem;
  font-weight: 600;
}
</style>
