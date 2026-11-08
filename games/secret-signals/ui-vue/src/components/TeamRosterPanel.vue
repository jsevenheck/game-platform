<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { PlayerView, TeamColor } from '@shared/types';
import { TEAM_HEX, TEAM_TEXT_HEX } from '../lib/teamTheme';

const props = defineProps<{
  teamColor: TeamColor;
  players: PlayerView[];
  isCurrentTurn: boolean;
  eliminated: boolean;
}>();

const { t } = useI18n();
const director = computed(() => props.players.find((player) => player.role === 'director') ?? null);
const agents = computed(() => props.players.filter((player) => player.role === 'agent'));
</script>

<template>
  <section
    class="roster-panel"
    :class="{ 'is-current': isCurrentTurn, 'is-eliminated': eliminated }"
    :style="{ '--team-color': TEAM_HEX[teamColor], '--team-ink': TEAM_TEXT_HEX[teamColor] }"
  >
    <header class="roster-header">
      <h3>{{ t('secret-signals.teamOf', { color: t(`secret-signals.teams.${teamColor}`) }) }}</h3>
      <span v-if="isCurrentTurn" class="ui-badge turn-badge">{{
        t('secret-signals.roster.turn')
      }}</span>
      <span v-else-if="eliminated" class="ui-badge out-badge">{{
        t('secret-signals.roster.out')
      }}</span>
    </header>

    <div class="roster-group">
      <span class="role-label">{{ t('secret-signals.roster.directorLabel') }}</span>
      <span class="director-name" :class="{ 'is-empty': !director }">
        {{ director?.name ?? t('secret-signals.roster.unassigned') }}
      </span>
    </div>

    <div class="roster-group">
      <span class="role-label">{{ t('secret-signals.roster.agents') }}</span>
      <ul class="agent-list">
        <li v-for="agent in agents" :key="agent.id" class="agent-name">{{ agent.name }}</li>
        <li v-if="agents.length === 0" class="is-empty">
          {{ t('secret-signals.roster.noAgents') }}
        </li>
      </ul>
    </div>
  </section>
</template>

<style scoped>
.roster-panel {
  --roster-shell: #102d35;
  --roster-panel: #163943;
  --roster-paper: #f2e8d5;
  --roster-muted: #b9c9c8;
  min-width: 0;
  border: 1px solid #36545a;
  border-radius: 8px;
  background: var(--roster-panel);
  color: var(--roster-paper);
}
.is-current {
  outline: 2px solid var(--roster-paper);
  outline-offset: 2px;
}
.is-eliminated {
  border-style: dashed;
}
.roster-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  padding: 10px 12px;
  border-radius: 7px 7px 0 0;
  color: var(--team-ink);
  background: var(--team-color);
}
.roster-header h3 {
  min-width: 0;
  margin: 0;
  font-size: 0.875rem;
  font-weight: 800;
  overflow-wrap: anywhere;
}
.turn-badge,
.out-badge {
  background: var(--roster-shell);
  color: var(--roster-paper);
  white-space: normal;
}
.roster-group {
  display: grid;
  gap: 4px;
  padding: 10px 12px;
}
.roster-group + .roster-group {
  border-top: 1px solid #36545a;
}
.role-label {
  color: var(--roster-muted);
  font-size: 0.65rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.director-name,
.agent-name {
  overflow-wrap: anywhere;
  font-size: 0.875rem;
  font-weight: 600;
}
.agent-list {
  display: grid;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.is-empty {
  color: var(--roster-muted);
  font-size: 0.8rem;
  font-weight: 400;
  overflow-wrap: anywhere;
}
</style>
