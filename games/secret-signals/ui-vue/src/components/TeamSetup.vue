<script setup lang="ts">
import { computed } from 'vue';
import {
  ASSASSIN_PENALTY_MODES,
  MAX_TEAMS,
  MIN_TEAMS,
  TEAM_HEX_BY_COLOR,
  TEAM_NAME_BY_COLOR,
} from '@shared/constants';
import type { AssassinPenaltyMode, PlayerRole, PlayerView, TeamColor } from '@shared/types';
import { useGameStore } from '../stores/game';

const store = useGameStore();

const emit = defineEmits<{
  'assign-team': [team: TeamColor];
  'assign-role': [role: PlayerRole];
  'set-team-count': [count: number];
  'set-assassin-penalty-mode': [mode: AssassinPenaltyMode];
}>();

const activeTeams = computed(() => store.room?.turnOrder ?? []);
const teamCountOptions = computed(() =>
  Array.from({ length: MAX_TEAMS - MIN_TEAMS + 1 }, (_, index) => index + MIN_TEAMS)
);

const unassigned = computed(() =>
  (store.room?.players ?? []).filter((p: PlayerView) => !p.team && p.connected)
);
const currentPlayer = computed(() => store.currentPlayer);
const currentPlayerTeam = computed(() => currentPlayer.value?.team ?? null);

function teamPlayers(color: TeamColor): PlayerView[] {
  return (store.room?.players ?? []).filter((p: PlayerView) => p.team === color && p.connected);
}

function pickTeam(team: TeamColor) {
  emit('assign-team', team);
}

function pickRole(role: PlayerRole) {
  emit('assign-role', role);
}

function isDirectorUnavailable(color: TeamColor): boolean {
  const director = teamPlayers(color).find((player) => player.role === 'director');
  return Boolean(director && director.id !== currentPlayer.value?.id);
}

const isSetupValid = computed(() => {
  if (!store.room) return false;
  const teams = activeTeams.value;
  for (const color of teams) {
    const players = teamPlayers(color);
    const directors = players.filter((p) => p.role === 'director');
    const agents = players.filter((p) => p.role === 'agent');
    if (directors.length !== 1 || agents.length < 1) return false;
  }
  return unassigned.value.length === 0;
});

defineExpose({ isSetupValid });
</script>

<template>
  <div class="team-setup">
    <div v-if="store.isHost" class="team-count-selector">
      <span class="label">Teams:</span>
      <button
        v-for="n in teamCountOptions"
        :key="n"
        class="count-btn"
        :class="{ active: store.room?.teamCount === n }"
        @click="$emit('set-team-count', n)"
      >
        {{ n }}
      </button>
    </div>

    <div class="mode-selector">
      <span class="label">Assassin:</span>
      <button
        v-for="mode in ASSASSIN_PENALTY_MODES"
        :key="mode"
        :data-mode="mode"
        class="mode-btn"
        :class="{ active: store.room?.assassinPenaltyMode === mode, clickable: store.isHost }"
        :disabled="!store.isHost"
        @click="$emit('set-assassin-penalty-mode', mode)"
      >
        {{ mode === 'instant-loss' ? 'End Match' : 'Eliminate Team' }}
      </button>
    </div>
    <p class="mode-hint">
      {{
        store.room?.assassinPenaltyMode === 'instant-loss'
          ? 'An assassin hit ends the match immediately.'
          : 'An assassin hit removes that team and the match continues.'
      }}
    </p>

    <div v-if="currentPlayer" class="self-setup">
      <h4 class="section-title">Your Seat</h4>
      <p class="self-setup-text">
        Pick your own team and role. The host only controls match settings and start.
      </p>

      <div class="self-team-picker">
        <button
          v-for="color in activeTeams"
          :key="color"
          :data-self-team="color"
          class="self-team-btn"
          :class="{ active: currentPlayerTeam === color }"
          :style="{
            borderColor: TEAM_HEX_BY_COLOR[color],
            backgroundColor: currentPlayerTeam === color ? TEAM_HEX_BY_COLOR[color] : undefined,
          }"
          @click="pickTeam(color)"
        >
          {{ TEAM_NAME_BY_COLOR[color] }}
        </button>
      </div>

      <div v-if="currentPlayerTeam" class="self-role-picker">
        <button
          data-self-role="director"
          class="self-role-btn"
          :class="{ active: currentPlayer?.role === 'director' }"
          :disabled="isDirectorUnavailable(currentPlayerTeam)"
          @click="pickRole('director')"
        >
          Director
        </button>
        <button
          data-self-role="agent"
          class="self-role-btn"
          :class="{ active: currentPlayer?.role === 'agent' }"
          @click="pickRole('agent')"
        >
          Agent
        </button>
      </div>

      <p v-if="currentPlayerTeam && isDirectorUnavailable(currentPlayerTeam)" class="role-hint">
        Director is already taken on {{ TEAM_NAME_BY_COLOR[currentPlayerTeam] }} Team.
      </p>
    </div>

    <div v-if="unassigned.length > 0" class="unassigned-section">
      <h4 class="section-title">Unassigned</h4>
      <div
        v-for="player in unassigned"
        :key="player.id"
        :data-player-name="player.name"
        class="player-chip"
      >
        {{ player.name }}
        <span v-if="player.isHost" class="badge host">H</span>
      </div>
    </div>

    <div class="teams-grid">
      <div v-for="color in activeTeams" :key="color" :data-team-color="color" class="team-column">
        <h4 class="team-header" :style="{ borderBottomColor: TEAM_HEX_BY_COLOR[color] }">
          {{ TEAM_NAME_BY_COLOR[color] }} Team
        </h4>
        <div v-if="teamPlayers(color).length === 0" class="empty-team">No players</div>
        <div
          v-for="player in teamPlayers(color)"
          :key="player.id"
          :data-player-name="player.name"
          class="player-row"
        >
          <span class="player-name">
            {{ player.name }}
          </span>
          <button v-if="player.role" class="role-badge" :class="[player.role]">
            {{ player.role === 'director' ? 'DIR' : 'AGT' }}
          </button>
          <button v-else class="role-badge unset">?</button>
        </div>
      </div>
    </div>

    <div v-if="!isSetupValid" class="validation-warning">
      Each team needs 1 Director and at least 1 Agent. All players must be assigned.
    </div>
  </div>
</template>

<style scoped>
.team-setup {
  width: 100%;
  max-width: 600px;
}

.team-count-selector {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 1rem;
  justify-content: center;
}

.mode-selector {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 0.25rem;
}

.label {
  color: #a1a1aa;
  font-size: 0.85rem;
  font-weight: 600;
}

.count-btn {
  width: 36px;
  height: 36px;
  border: 2px solid #3f3f46;
  border-radius: 6px;
  background: #18181b;
  color: #d4d4d8;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
}

.count-btn.active {
  border-color: #8b5cf6;
  background: #8b5cf6;
  color: #fff;
}

.count-btn:hover:not(.active) {
  border-color: #8b5cf6;
}

.mode-btn {
  padding: 0.45rem 0.75rem;
  border: 2px solid #3f3f46;
  border-radius: 999px;
  background: #18181b;
  color: #d4d4d8;
  font-size: 0.8rem;
  font-weight: 700;
  transition: all 0.2s;
}

.mode-btn.clickable {
  cursor: pointer;
}

.mode-btn.active {
  border-color: #8b5cf6;
  background: #8b5cf6;
  color: #fff;
}

.mode-hint {
  margin-bottom: 1rem;
  text-align: center;
  color: #71717a;
  font-size: 0.8rem;
}

.self-setup {
  margin-bottom: 1.25rem;
  padding: 0.9rem;
  border: 1px solid #27272a;
  border-radius: 12px;
  background: #141417;
}

.self-setup-text {
  margin-bottom: 0.75rem;
  text-align: center;
  color: #a1a1aa;
  font-size: 0.85rem;
}

.self-team-picker,
.self-role-picker {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.5rem;
}

.self-team-picker {
  margin-bottom: 0.75rem;
}

.self-team-btn,
.self-role-btn {
  border: 2px solid #3f3f46;
  border-radius: 999px;
  background: #18181b;
  color: #f4f4f5;
  font-size: 0.8rem;
  font-weight: 700;
  transition: all 0.2s;
}

.self-team-btn {
  padding: 0.45rem 0.9rem;
  cursor: pointer;
}

.self-role-btn {
  min-width: 96px;
  padding: 0.45rem 0.75rem;
  cursor: pointer;
}

.self-role-btn.active {
  border-color: #8b5cf6;
  background: #8b5cf6;
  color: #fff;
}

.self-team-btn:hover,
.self-role-btn:hover:not(:disabled) {
  filter: brightness(1.08);
}

.self-role-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.role-hint {
  margin-top: 0.65rem;
  text-align: center;
  color: #a1a1aa;
  font-size: 0.8rem;
}

.unassigned-section {
  margin-bottom: 1rem;
  text-align: center;
}

.section-title {
  color: #71717a;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin-bottom: 0.5rem;
}

.player-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.3rem 0.75rem;
  background: #27272a;
  border-radius: 20px;
  color: #d4d4d8;
  font-size: 0.85rem;
  margin: 0.2rem;
}

.badge.host {
  background: #8b5cf6;
  color: #fff;
  font-size: 0.6rem;
  padding: 0.1rem 0.3rem;
  border-radius: 3px;
  font-weight: 700;
}

.teams-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 0.75rem;
}

.team-column {
  background: #1c1c1f;
  border-radius: 8px;
  padding: 0.75rem;
}

.team-header {
  color: #e4e4e7;
  font-size: 0.85rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding-bottom: 0.5rem;
  border-bottom: 3px solid;
  margin-bottom: 0.5rem;
}

.empty-team {
  color: #52525b;
  font-size: 0.8rem;
  font-style: italic;
}

.player-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.3rem 0;
}

.player-name {
  color: #d4d4d8;
  font-size: 0.85rem;
}

.role-badge {
  padding: 0.15rem 0.4rem;
  border-radius: 4px;
  font-size: 0.65rem;
  font-weight: 700;
  text-transform: uppercase;
  border: none;
  cursor: default;
}

.role-badge.director {
  background: #7c3aed;
  color: #fff;
}

.role-badge.agent {
  background: #3f3f46;
  color: #d4d4d8;
}

.role-badge.unset {
  background: #27272a;
  color: #71717a;
  border: 1px dashed #52525b;
}

.validation-warning {
  margin-top: 0.75rem;
  text-align: center;
  color: #f59e0b;
  font-size: 0.8rem;
}
</style>
