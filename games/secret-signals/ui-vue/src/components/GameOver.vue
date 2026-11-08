<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { TeamColor, PlayerView } from '@shared/types';
import { TEAM_HEX, TEAM_TEXT_HEX } from '../lib/teamTheme';
import { useGameStore } from '../stores/game';
import GameBoard from './GameBoard.vue';

withDefaults(defineProps<{ pending?: boolean }>(), { pending: false });
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
  <div class="game-over">
    <header class="result-header">
      <h1>{{ t('secret-signals.gameOver.title') }}</h1>
      <div
        v-if="store.room?.winningTeams.length"
        class="winner-panel"
        :style="
          store.room.winningTeams.length === 1
            ? {
                backgroundColor: TEAM_HEX[store.room.winningTeams[0]],
                color: TEAM_TEXT_HEX[store.room.winningTeams[0]],
              }
            : undefined
        "
      >
        <p>
          {{
            store.room.winningTeams.length === 1
              ? t('secret-signals.gameOver.winner')
              : t('secret-signals.gameOver.winners')
          }}
        </p>
        <h2>{{ winningLabel }}</h2>
      </div>
    </header>

    <div class="final-board">
      <h3>{{ t('secret-signals.gameOver.finalBoard') }}</h3>
      <GameBoard />
    </div>

    <div class="team-results">
      <div
        v-for="team in store.room?.teams"
        :key="team.color"
        class="team-result"
        :class="{ 'is-eliminated': team.eliminated }"
        :style="{ '--team-color': TEAM_HEX[team.color], '--team-ink': TEAM_TEXT_HEX[team.color] }"
      >
        <span class="team-label">{{ teamName(team.color) }}</span>
        <strong class="team-score">{{ team.revealedCount }} / {{ team.targetCount }}</strong>
        <span v-if="team.eliminated" class="eliminated-label">{{
          t('secret-signals.gameOver.eliminated')
        }}</span>
      </div>
    </div>

    <footer class="result-action">
      <button
        v-if="isHost"
        class="ui-btn-primary restart-button"
        :aria-disabled="pending"
        @click="$emit('restart')"
      >
        {{ t('secret-signals.gameOver.playAgain') }}
      </button>
      <p v-else>{{ t('secret-signals.gameOver.waiting') }}</p>
    </footer>
  </div>
</template>

<style scoped>
.game-over {
  --result-shell: #102d35;
  --result-panel: #163943;
  --result-paper: #f2e8d5;
  --result-muted: #b9c9c8;
  display: grid;
  gap: 20px;
  min-width: 0;
  width: 100%;
  max-width: 760px;
  margin-inline: auto;
  padding: 16px 10px 24px;
  border-radius: 12px;
  color: var(--result-paper);
  background: var(--result-shell);
}
.result-header {
  display: grid;
  gap: 12px;
  text-align: center;
}
.result-header h1 {
  margin: 0;
  font-size: clamp(1.4rem, 5vw, 2rem);
  font-weight: 800;
  overflow-wrap: anywhere;
}
.winner-panel {
  padding: 14px;
  border-radius: 8px;
  background: var(--result-paper);
  color: var(--result-shell);
}
.winner-panel p {
  margin: 0 0 4px;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}
.winner-panel h2 {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 800;
  overflow-wrap: anywhere;
}
.final-board {
  min-width: 0;
}
.final-board h3 {
  margin: 0 0 10px;
  color: var(--result-muted);
  font-size: 0.8rem;
  font-weight: 700;
}
.team-results {
  display: grid;
  gap: 8px;
}
.team-result {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  min-width: 0;
  padding: 10px 12px;
  border: 1px solid #36545a;
  border-color: var(--team-color);
  border-radius: 6px;
  background: var(--result-panel);
}
.team-label {
  min-width: 0;
  flex: 1;
  overflow-wrap: anywhere;
  font-size: 0.875rem;
  font-weight: 700;
}
.team-score {
  padding: 4px 8px;
  border-radius: 4px;
  color: var(--team-ink);
  background: var(--team-color);
  font-size: 0.875rem;
  font-variant-numeric: tabular-nums;
}
.eliminated-label {
  flex-basis: 100%;
  color: var(--result-muted);
  font-size: 0.7rem;
  text-transform: uppercase;
}
.is-eliminated {
  border-style: dashed;
}
.result-action {
  text-align: center;
}
.restart-button {
  min-height: 48px;
  width: 100%;
  border: 2px solid var(--result-paper);
  border-radius: 8px;
  background: var(--result-paper);
  color: var(--result-shell);
  white-space: normal;
}
.restart-button:hover {
  background: #fff7e8;
}
.restart-button:focus-visible {
  outline: 3px solid var(--result-paper);
  outline-offset: 4px;
}
.result-action p {
  margin: 0;
  color: var(--result-muted);
  font-size: 0.875rem;
}
@media (min-width: 640px) {
  .game-over {
    padding: 24px;
  }
  .team-results {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
