<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { ASSASSIN_PENALTY_MODES, MAX_TEAMS, MIN_TEAMS, TEAM_HEX_BY_COLOR } from '@shared/constants';
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
  <div class="w-full max-w-150">
    <div v-if="store.isHost" class="flex items-center flex-wrap gap-2 mb-4 justify-center">
      <span class="text-muted text-sm font-semibold">{{ t('secret-signals.setup.teams') }}</span>
      <button
        v-for="n in teamCountOptions"
        :key="n"
        class="w-9 h-9 border-2 border-border-strong rounded-sm bg-panel text-foreground/80 font-bold cursor-pointer transition-all"
        :class="{ 'signals-active': store.room?.teamCount === n }"
        @click="$emit('set-team-count', n)"
      >
        {{ n }}
      </button>
    </div>

    <div class="flex items-center justify-center flex-wrap gap-2 mb-1">
      <span class="text-muted text-sm font-semibold">{{ t('secret-signals.setup.assassin') }}</span>
      <button
        v-for="mode in ASSASSIN_PENALTY_MODES"
        :key="mode"
        :data-mode="mode"
        class="px-3 py-1.5 border-2 border-border-strong rounded-full bg-panel text-foreground/80 text-xs font-bold transition-all"
        :class="{
          'signals-active': store.room?.assassinPenaltyMode === mode,
          'cursor-pointer': store.isHost,
        }"
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
    <p class="mode-hint mb-4 text-center text-muted-foreground text-xs">
      {{
        store.room?.assassinPenaltyMode === 'instant-loss'
          ? t('secret-signals.setup.instantLossHint')
          : t('secret-signals.setup.eliminateHint')
      }}
    </p>

    <div v-if="currentPlayer" class="mb-5 p-3.5 border border-border rounded-lg bg-shell">
      <h4 class="ui-section-label">{{ t('secret-signals.setup.yourSeat') }}</h4>
      <p class="mb-3 text-center text-muted text-sm">
        {{ t('secret-signals.setup.seatHint') }}
      </p>

      <div class="flex flex-wrap justify-center gap-2 mb-3">
        <button
          v-for="color in activeTeams"
          :key="color"
          :data-self-team="color"
          class="px-3.5 py-1.5 border-2 border-border-strong rounded-full bg-panel text-foreground/95 text-xs font-bold cursor-pointer transition-all hover:brightness-110"
          :class="{ 'active-team-btn': currentPlayerTeam === color }"
          :style="{
            borderColor: TEAM_HEX_BY_COLOR[color],
            backgroundColor: currentPlayerTeam === color ? TEAM_HEX_BY_COLOR[color] : undefined,
          }"
          @click="pickTeam(color)"
        >
          {{ teamName(color) }}
        </button>
      </div>

      <div v-if="currentPlayerTeam" class="flex flex-wrap justify-center gap-2">
        <button
          data-self-role="director"
          class="min-w-24 px-3 py-1.5 border-2 border-border-strong rounded-full bg-panel text-foreground/95 text-xs font-bold cursor-pointer transition-all hover:brightness-110"
          :class="{ 'signals-active': currentPlayer?.role === 'director' }"
          :disabled="isDirectorUnavailable(currentPlayerTeam)"
          @click="pickRole('director')"
        >
          {{ t('secret-signals.roles.director') }}
        </button>
        <button
          data-self-role="agent"
          class="min-w-24 px-3 py-1.5 border-2 border-border-strong rounded-full bg-panel text-foreground/95 text-xs font-bold cursor-pointer transition-all hover:brightness-110"
          :class="{ 'signals-active': currentPlayer?.role === 'agent' }"
          @click="pickRole('agent')"
        >
          {{ t('secret-signals.roles.agent') }}
        </button>
      </div>

      <p
        v-if="currentPlayerTeam && isDirectorUnavailable(currentPlayerTeam)"
        class="mt-2.5 text-center text-muted text-xs"
      >
        {{ t('secret-signals.setup.directorTaken', { team: teamLabel(currentPlayerTeam) }) }}
      </p>
    </div>

    <div v-if="unassigned.length > 0" class="mb-4 text-center">
      <h4 class="ui-section-label">{{ t('secret-signals.setup.unassigned') }}</h4>
      <div
        v-for="player in unassigned"
        :key="player.id"
        :data-player-name="player.name"
        class="inline-flex items-center gap-1 px-3 py-1 bg-elevated rounded-full text-foreground/85 text-sm mx-0.5 my-0.5"
      >
        {{ player.name }}
        <span
          v-if="player.isHost"
          class="ui-badge bg-signals text-white text-[0.6rem]! px-1.5! py-0.5! rounded-sm!"
          >{{ t('secret-signals.setup.hostShort') }}</span
        >
      </div>
    </div>

    <div class="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-3">
      <div
        v-for="color in activeTeams"
        :key="color"
        :data-team-color="color"
        class="bg-shell rounded-sm p-3"
      >
        <h4
          class="text-foreground/90 text-sm font-bold uppercase tracking-wider pb-2 border-b-[3px] mb-2"
          :style="{ borderBottomColor: TEAM_HEX_BY_COLOR[color] }"
        >
          {{ teamLabel(color) }}
        </h4>
        <div v-if="teamPlayers(color).length === 0" class="text-muted-foreground/60 text-xs italic">
          {{ t('secret-signals.setup.noPlayers') }}
        </div>
        <div
          v-for="player in teamPlayers(color)"
          :key="player.id"
          :data-player-name="player.name"
          class="flex items-center justify-between py-1"
        >
          <span class="agent-name text-foreground/85 text-sm">{{ player.name }}</span>
          <button
            v-if="player.role"
            class="px-1.5 py-0.5 rounded-sm text-[0.65rem] font-bold uppercase border-none cursor-default"
            :class="{
              'bg-violet-600 text-white': player.role === 'director',
              'bg-border-strong text-foreground/85': player.role === 'agent',
            }"
          >
            {{
              player.role === 'director'
                ? t('secret-signals.roles.directorShort')
                : t('secret-signals.roles.agentShort')
            }}
          </button>
          <button
            v-else
            class="px-1.5 py-0.5 rounded-sm text-[0.65rem] font-bold bg-elevated text-muted-foreground border border-dashed border-muted-foreground/40 cursor-default"
          >
            ?
          </button>
        </div>
      </div>
    </div>

    <div v-if="!isSetupValid" class="mt-3 text-center text-warning text-xs">
      {{ t('secret-signals.setup.rules') }}
    </div>
  </div>
</template>

<style scoped>
.signals-active {
  border-color: var(--color-signals);
  background: var(--color-signals);
  color: white;
}
</style>
