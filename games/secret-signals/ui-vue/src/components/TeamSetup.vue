<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { ASSASSIN_PENALTY_MODES, MAX_TEAMS, MIN_TEAMS } from '@shared/constants';
import { TEAM_HEX, TEAM_TEXT_HEX } from '../lib/teamTheme';
import type { AssassinPenaltyMode, PlayerRole, PlayerView, TeamColor } from '@shared/types';
import { useGameStore } from '../stores/game';

const { t } = useI18n();
const store = useGameStore();

const teamName = (color: TeamColor) => t(`secret-signals.teams.${color}`);
const teamLabel = (color: TeamColor) => t('secret-signals.teamOf', { color: teamName(color) });

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
    <div v-if="store.isHost" class="settings-row">
      <span class="setting-label">{{ t('secret-signals.setup.teams') }}</span>
      <button
        v-for="n in teamCountOptions"
        :key="n"
        class="setup-choice count-choice"
        :class="{ 'signals-active': store.room?.teamCount === n }"
        :aria-pressed="store.room?.teamCount === n"
        @click="$emit('set-team-count', n)"
      >
        {{ n }}
      </button>
    </div>

    <div class="settings-row assassin-settings">
      <span class="setting-label">{{ t('secret-signals.setup.assassin') }}</span>
      <button
        v-for="mode in ASSASSIN_PENALTY_MODES"
        :key="mode"
        :data-mode="mode"
        class="setup-choice mode-choice"
        :class="{
          'signals-active': store.room?.assassinPenaltyMode === mode,
          'cursor-pointer': store.isHost,
        }"
        :aria-pressed="store.room?.assassinPenaltyMode === mode"
        :disabled="!store.isHost"
        @click="$emit('set-assassin-penalty-mode', mode)"
      >
        {{
          mode === 'instant-loss'
            ? t('secret-signals.setup.endMatch')
            : t('secret-signals.setup.eliminateTeam')
        }}
      </button>
    </div>
    <p class="mode-hint">
      {{
        store.room?.assassinPenaltyMode === 'instant-loss'
          ? t('secret-signals.setup.instantLossHint')
          : t('secret-signals.setup.eliminateHint')
      }}
    </p>

    <div v-if="currentPlayer" class="seat-panel">
      <p class="seat-hint">
        {{ t('secret-signals.setup.seatHint') }}
      </p>

      <div class="team-choices">
        <button
          v-for="color in activeTeams"
          :key="color"
          :data-self-team="color"
          class="setup-choice team-choice"
          :class="{ 'active-team-btn': currentPlayerTeam === color }"
          :aria-pressed="currentPlayerTeam === color"
          :style="{
            '--team-color': TEAM_HEX[color],
            '--team-ink': TEAM_TEXT_HEX[color],
          }"
          @click="pickTeam(color)"
        >
          {{ teamName(color) }}
        </button>
      </div>

      <div v-if="currentPlayerTeam" class="role-choices">
        <button
          data-self-role="director"
          class="setup-choice role-choice"
          :class="{ 'signals-active': currentPlayer?.role === 'director' }"
          :aria-pressed="currentPlayer?.role === 'director'"
          :disabled="isDirectorUnavailable(currentPlayerTeam)"
          @click="pickRole('director')"
        >
          {{ t('secret-signals.roles.director') }}
        </button>
        <button
          data-self-role="agent"
          class="setup-choice role-choice"
          :class="{ 'signals-active': currentPlayer?.role === 'agent' }"
          :aria-pressed="currentPlayer?.role === 'agent'"
          @click="pickRole('agent')"
        >
          {{ t('secret-signals.roles.agent') }}
        </button>
      </div>

      <p v-if="currentPlayerTeam && isDirectorUnavailable(currentPlayerTeam)" class="seat-note">
        {{ t('secret-signals.setup.directorTaken', { team: teamLabel(currentPlayerTeam) }) }}
      </p>
    </div>

    <div v-if="unassigned.length > 0" class="unassigned-panel">
      <h4 class="section-label">{{ t('secret-signals.setup.unassigned') }}</h4>
      <div
        v-for="player in unassigned"
        :key="player.id"
        :data-player-name="player.name"
        class="unassigned-player"
      >
        {{ player.name }}
        <span v-if="player.isHost" class="ui-badge host-badge">{{
          t('secret-signals.setup.hostShort')
        }}</span>
      </div>
    </div>

    <div class="team-rosters">
      <div
        v-for="color in activeTeams"
        :key="color"
        :data-team-color="color"
        class="team-roster"
        :style="{ '--team-color': TEAM_HEX[color], '--team-ink': TEAM_TEXT_HEX[color] }"
      >
        <h4 class="team-heading">
          {{ teamLabel(color) }}
        </h4>
        <div v-if="teamPlayers(color).length === 0" class="empty-roster">
          {{ t('secret-signals.setup.noPlayers') }}
        </div>
        <div
          v-for="player in teamPlayers(color)"
          :key="player.id"
          :data-player-name="player.name"
          class="roster-player"
        >
          <span class="agent-name">{{ player.name }}</span>
          <span
            v-if="player.role"
            class="role-badge"
            :class="{ 'is-director': player.role === 'director' }"
          >
            {{
              player.role === 'director'
                ? t('secret-signals.roles.directorShort')
                : t('secret-signals.roles.agentShort')
            }}
          </span>
          <span v-else class="role-badge unassigned-role">?</span>
        </div>
      </div>
    </div>

    <div v-if="!isSetupValid" class="setup-rules">
      {{ t('secret-signals.setup.rules') }}
    </div>
  </div>
</template>

<style scoped>
.team-setup {
  --setup-paper: #f2e8d5;
  --setup-shell: #102d35;
  --setup-panel: #163943;
  --setup-muted: #b9c9c8;
  display: grid;
  gap: 12px;
  width: 100%;
  min-width: 0;
  color: var(--setup-paper);
}
.settings-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
.setting-label {
  flex: 1 1 100%;
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--setup-muted);
}
.setup-choice {
  min-height: 44px;
  min-width: 44px;
  padding: 8px 12px;
  border: 1px solid #688084;
  border-radius: 6px;
  background: var(--setup-panel);
  color: var(--setup-paper);
  font: inherit;
  font-size: 0.8rem;
  font-weight: 700;
  line-height: 1.3;
  overflow-wrap: anywhere;
  cursor: pointer;
}
.setup-choice:hover:not(:disabled) {
  border-color: var(--setup-paper);
}
.setup-choice:focus-visible {
  outline: 3px solid var(--setup-paper);
  outline-offset: 3px;
}
.setup-choice:disabled {
  cursor: default;
}
.role-choice:disabled {
  opacity: 0.45;
}
.signals-active {
  border-color: var(--setup-paper);
  background: var(--setup-paper);
  color: var(--setup-shell);
  box-shadow: inset 0 -3px 0 #c9bca5;
}
.mode-choice {
  flex: 1 1 110px;
}
.mode-hint,
.seat-note,
.setup-rules {
  margin: 0;
  color: var(--setup-muted);
  font-size: 0.75rem;
  line-height: 1.5;
  overflow-wrap: anywhere;
}
.seat-panel {
  display: grid;
  gap: 12px;
  padding: 14px;
  border: 1px solid #45646b;
  border-radius: 8px;
  background: var(--setup-panel);
}
.seat-hint {
  margin: 0;
  font-size: 0.875rem;
  line-height: 1.5;
}
.team-choices,
.role-choices {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}
.team-choice {
  border-color: var(--team-color);
}
.active-team-btn {
  color: var(--team-ink);
  background: var(--team-color);
  border-color: var(--team-color);
  outline: 2px solid var(--setup-paper);
  outline-offset: 2px;
  box-shadow: inset 0 -3px 0 rgb(0 0 0 / 20%);
}
.section-label {
  margin: 0 0 8px;
  color: var(--setup-muted);
  font-size: 0.75rem;
  font-weight: 700;
}
.unassigned-player {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin: 0 6px 6px 0;
  padding: 6px 10px;
  max-width: 100%;
  border-radius: 4px;
  background: var(--setup-panel);
  overflow-wrap: anywhere;
  font-size: 0.8rem;
}
.host-badge {
  color: var(--setup-shell);
  background: var(--setup-paper);
}
.team-rosters {
  display: grid;
  gap: 10px;
  grid-template-columns: minmax(0, 1fr);
}
.team-roster {
  min-width: 0;
  border: 1px solid #36545a;
  border-radius: 8px;
  overflow: hidden;
  background: var(--setup-panel);
}
.team-heading {
  margin: 0 0 4px;
  padding: 10px 12px;
  color: var(--team-ink);
  background: var(--team-color);
  font-size: 0.875rem;
  font-weight: 800;
  overflow-wrap: anywhere;
}
.roster-player {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
}
.agent-name {
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
  font-size: 0.875rem;
}
.role-badge {
  padding: 4px 6px;
  border: 1px solid #688084;
  border-radius: 4px;
  color: var(--setup-paper);
  font-size: 0.65rem;
  font-weight: 700;
  overflow-wrap: anywhere;
}
.is-director {
  color: var(--setup-shell);
  background: var(--setup-paper);
  border-color: var(--setup-paper);
}
.empty-roster {
  padding: 8px 12px 12px;
  color: var(--setup-muted);
  font-size: 0.75rem;
}
.setup-rules {
  padding: 10px 12px;
  border: 1px solid #dfc68f;
  border-radius: 6px;
  background: var(--setup-panel);
  color: #efdaad;
}
@media (min-width: 480px) {
  .team-rosters {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .setting-label {
    flex: 0 0 100px;
  }
}
</style>
