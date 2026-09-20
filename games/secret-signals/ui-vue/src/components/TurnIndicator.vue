<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { TEAM_HEX_BY_COLOR } from '@shared/constants';
import { useGameStore } from '../stores/game';

const { t } = useI18n();
const store = useGameStore();
</script>

<template>
  <div
    class="turn-indicator flex items-center justify-center gap-6 px-4 py-3 sm:px-28 bg-shell border-b border-border flex-wrap"
  >
    <div class="flex items-center gap-3">
      <div
        v-if="store.room?.currentTurnTeam"
        class="px-3 py-1 rounded-sm text-white font-bold text-sm uppercase tracking-wider"
        :style="{ backgroundColor: TEAM_HEX_BY_COLOR[store.room.currentTurnTeam] }"
      >
        {{
          t('secret-signals.teamOf', {
            color: t(`secret-signals.teams.${store.room.currentTurnTeam}`),
          })
        }}
      </div>
      <span class="text-muted text-sm">
        {{
          store.room?.turnPhase === 'giving-signal'
            ? t('secret-signals.turn.directorThinking')
            : t('secret-signals.turn.agentsGuessing')
        }}
      </span>
    </div>

    <div
      v-if="store.room?.currentSignal && store.room.turnPhase === 'guessing'"
      class="flex items-center gap-2 px-3 py-1.5 bg-elevated rounded-sm"
    >
      <span class="text-foreground font-bold uppercase">{{ store.room.currentSignal.word }}</span>
      <span class="text-signals font-bold text-lg">{{ store.room.currentSignal.number }}</span>
      <span class="text-muted-foreground text-xs">
        ({{ store.room.currentSignal.guessesUsed }} /
        {{
          store.room.currentSignal.number === 0 ? '\u221E' : store.room.currentSignal.number + 1
        }})
      </span>
    </div>

    <div class="flex gap-3">
      <div
        v-for="team in store.room?.teams"
        :key="team.color"
        class="flex items-center gap-1"
        :class="{ 'opacity-30 line-through': team.eliminated }"
      >
        <span
          class="w-2.5 h-2.5 rounded-full"
          :style="{ backgroundColor: TEAM_HEX_BY_COLOR[team.color] }"
        />
        <span class="text-foreground/85 text-xs font-semibold"
          >{{ team.revealedCount }}/{{ team.targetCount }}</span
        >
      </div>
    </div>
  </div>
</template>
