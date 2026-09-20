<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { TEAM_HEX_BY_COLOR } from '@shared/constants';
import type { TeamColor } from '@shared/types';
import type { PlayerView } from '@shared/types';
import { useGameStore } from '../stores/game';
import GameBoard from './GameBoard.vue';

const { t } = useI18n();
const store = useGameStore();

const teamName = (color: TeamColor) => t(`secret-signals.teams.${color}`);

defineEmits<{
  restart: [];
}>();

const isHost = computed(
  () => store.room?.players.find((p: PlayerView) => p.id === store.playerId)?.isHost ?? false
);

const winningLabel = computed(() => {
  const winners = store.room?.winningTeams ?? [];
  if (winners.length === 0) return null;
  if (winners.length === 1) return t('secret-signals.teamOf', { color: teamName(winners[0]) });
  return winners.map((team) => teamName(team)).join(', ');
});
</script>

<template>
  <div class="game-over flex flex-col items-center gap-8 px-4 py-8">
    <h1 class="text-4xl font-black text-foreground">{{ t('secret-signals.gameOver.title') }}</h1>

    <div v-if="store.room?.winningTeams.length" class="text-center">
      <p class="text-muted uppercase text-sm tracking-widest">
        {{
          store.room.winningTeams.length === 1
            ? t('secret-signals.gameOver.winner')
            : t('secret-signals.gameOver.winners')
        }}
      </p>
      <h2
        class="text-3xl font-bold"
        :style="{
          color:
            store.room.winningTeams.length === 1
              ? TEAM_HEX_BY_COLOR[store.room.winningTeams[0]]
              : '#fff',
        }"
      >
        {{ winningLabel }}
      </h2>
    </div>

    <div class="w-full max-w-180">
      <h3 class="text-muted text-center mb-4">{{ t('secret-signals.gameOver.finalBoard') }}</h3>
      <GameBoard />
    </div>

    <div class="flex flex-col gap-2 w-full max-w-[320px]">
      <div
        v-for="team in store.room?.teams"
        :key="team.color"
        class="flex items-center gap-2 px-3 py-2.5 bg-elevated rounded-sm"
        :class="{ 'opacity-50': team.eliminated }"
      >
        <span
          class="w-3 h-3 rounded-full"
          :style="{ backgroundColor: TEAM_HEX_BY_COLOR[team.color] }"
        />
        <span class="flex-1 text-foreground font-semibold">{{ teamName(team.color) }}</span>
        <span class="text-signals font-bold"
          >{{ team.revealedCount }} / {{ team.targetCount }}</span
        >
        <span v-if="team.eliminated" class="text-[0.7rem] text-danger uppercase">{{
          t('secret-signals.gameOver.eliminated')
        }}</span>
      </div>
    </div>

    <button
      v-if="isHost"
      class="ui-btn-primary btn-signals btn-signals-hover"
      @click="$emit('restart')"
    >
      {{ t('secret-signals.gameOver.playAgain') }}
    </button>
    <p v-else class="text-muted-foreground">{{ t('secret-signals.gameOver.waiting') }}</p>
  </div>
</template>

<style scoped>
.btn-signals {
  background: var(--color-signals);
}
.btn-signals-hover:hover:not(:disabled) {
  background: var(--color-signals-hover);
}
</style>
