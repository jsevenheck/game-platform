<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { TEAM_HEX_BY_COLOR } from '@shared/constants';
import { useGameStore } from '../stores/game';
const { t } = useI18n();
const store = useGameStore();
const instruction = computed(() => {
  if (store.canGiveSignal) return t('secret-signals.turn.giveSignal');
  if (store.canGuess) return t('secret-signals.turn.chooseCard');
  return store.room?.turnPhase === 'giving-signal'
    ? t('secret-signals.turn.directorThinking')
    : t('secret-signals.turn.agentsGuessing');
});
</script>

<template>
  <header class="turn-indicator">
    <div class="turn-heading" aria-live="polite">
      <span
        class="active-team"
        :style="{
          '--team-color': store.room?.currentTurnTeam
            ? TEAM_HEX_BY_COLOR[store.room.currentTurnTeam]
            : '#f2e8d5',
        }"
      >
        <span class="team-dot" aria-hidden="true" />
        {{
          t('secret-signals.teamOf', {
            color: t(`secret-signals.teams.${store.room?.currentTurnTeam}`),
          })
        }}
      </span>
      <h1>{{ instruction }}</h1>
    </div>
    <ul class="team-scores" :aria-label="t('secret-signals.turn.scoreboard')">
      <li
        v-for="team in store.room?.teams"
        :key="team.color"
        class="team-score"
        :class="{ active: store.room?.currentTurnTeam === team.color, eliminated: team.eliminated }"
        :style="{ '--team-color': TEAM_HEX_BY_COLOR[team.color] }"
        :aria-label="
          team.eliminated
            ? `${t(`secret-signals.teams.${team.color}`)}, ${t('secret-signals.roster.out')}`
            : t('secret-signals.turn.remaining', {
                team: t(`secret-signals.teams.${team.color}`),
                count: team.targetCount - team.revealedCount,
              })
        "
      >
        <span class="team-dot" aria-hidden="true" />
        <span class="score-name">{{ t(`secret-signals.teams.${team.color}`) }}</span>
        <strong>{{ team.targetCount - team.revealedCount }}</strong>
      </li>
    </ul>
  </header>
</template>

<style scoped>
.turn-indicator {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem 1.5rem;
  max-width: 76rem;
  width: 100%;
  margin-inline: auto;
  padding: 1rem 1rem 0.75rem;
  color: #f4f7f6;
}
.turn-heading {
  min-width: 0;
}
h1 {
  font-size: clamp(1rem, 3.8vw, 1.4rem);
  font-weight: 800;
  line-height: 1.2;
  margin-top: 0.25rem;
  overflow-wrap: anywhere;
}
.active-team {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.75rem;
  font-weight: 600;
}
.team-dot {
  display: inline-block;
  width: 0.6rem;
  height: 0.6rem;
  flex-shrink: 0;
  border-radius: 50%;
  background: var(--team-color);
}
.team-scores {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  list-style: none;
  margin: 0;
  padding: 0;
}
.team-score {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.3rem 0.6rem;
  border: 1px solid #47717b;
  border-radius: 0.4rem;
  font-size: 0.75rem;
}
.team-score.active {
  border-color: var(--team-color);
  background: #163943;
}
.team-score strong {
  font-size: 1.35rem;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}
.team-score.eliminated {
  text-decoration: line-through;
  opacity: 0.65;
}
@media (max-width: 380px) {
  .turn-indicator {
    padding-inline: 0.6rem;
  }
  .team-score {
    padding-inline: 0.4rem;
  }
}
</style>
