<script setup lang="ts">
import { computed } from 'vue';
import { TEAM_HEX_BY_COLOR, TEAM_NAME_BY_COLOR } from '@shared/constants';
import type { PlayerView, TeamColor } from '@shared/types';

const props = defineProps<{
  teamColor: TeamColor;
  players: PlayerView[];
  isCurrentTurn: boolean;
  eliminated: boolean;
}>();

const director = computed(() => props.players.find((player) => player.role === 'director') ?? null);
const agents = computed(() => props.players.filter((player) => player.role === 'agent'));
</script>

<template>
  <section class="roster-panel" :class="{ current: isCurrentTurn, eliminated }">
    <header class="roster-header" :style="{ borderColor: TEAM_HEX_BY_COLOR[teamColor] }">
      <div class="roster-title-row">
        <h3 class="roster-title">{{ TEAM_NAME_BY_COLOR[teamColor] }} Team</h3>
        <span v-if="isCurrentTurn" class="turn-chip">Turn</span>
        <span v-else-if="eliminated" class="turn-chip danger">Out</span>
      </div>
    </header>

    <div class="roster-section">
      <span class="roster-label">Director</span>
      <span class="roster-name" :class="{ missing: !director }">
        {{ director?.name ?? 'Unassigned' }}
      </span>
    </div>

    <div class="roster-section">
      <span class="roster-label">Agents</span>
      <ul class="agent-list">
        <li v-for="agent in agents" :key="agent.id" class="agent-name">
          {{ agent.name }}
        </li>
        <li v-if="agents.length === 0" class="agent-name missing">No agents</li>
      </ul>
    </div>
  </section>
</template>

<style scoped>
.roster-panel {
  min-width: 180px;
  padding: 0.85rem 0.9rem;
  border: 1px solid #27272a;
  border-radius: 14px;
  background: #141417;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);
}

.roster-panel.current {
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.03),
    0 0 0 1px rgba(139, 92, 246, 0.25);
}

.roster-panel.eliminated {
  opacity: 0.55;
}

.roster-header {
  margin-bottom: 0.7rem;
  padding-bottom: 0.55rem;
  border-bottom: 3px solid;
}

.roster-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.roster-title {
  color: #f4f4f5;
  font-size: 0.85rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.turn-chip {
  padding: 0.18rem 0.45rem;
  border-radius: 999px;
  background: #8b5cf6;
  color: #fff;
  font-size: 0.68rem;
  font-weight: 800;
  text-transform: uppercase;
}

.turn-chip.danger {
  background: #3f3f46;
}

.roster-section {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.roster-section + .roster-section {
  margin-top: 0.65rem;
}

.roster-label {
  color: #71717a;
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.roster-name,
.agent-name {
  color: #e4e4e7;
  font-size: 0.88rem;
  font-weight: 600;
}

.agent-list {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  list-style: none;
}

.missing {
  color: #71717a;
  font-style: italic;
}
</style>
