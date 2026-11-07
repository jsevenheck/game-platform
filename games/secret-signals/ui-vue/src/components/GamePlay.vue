<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useGameStore } from '../stores/game';
import TurnIndicator from './TurnIndicator.vue';
import GameBoard from './GameBoard.vue';
import SignalInput from './SignalInput.vue';
import GameLog from './GameLog.vue';
import TeamRosterPanel from './TeamRosterPanel.vue';

const props = withDefaults(defineProps<{ pending?: boolean }>(), { pending: false });
const { t } = useI18n();
const store = useGameStore();
const selectedCardIndex = ref<number | null>(null);
const emit = defineEmits<{
  'focus-card': [cardIndex: number | null];
  'give-signal': [word: string, number: number];
  'reveal-card': [cardIndex: number];
  'end-turn': [];
  'skip-guess-round': [];
}>();
const rosterTeams = computed(() =>
  (store.room?.teams ?? []).map((team) => ({
    ...team,
    players: (store.room?.players ?? []).filter(
      (player) => player.team === team.color && player.connected
    ),
  }))
);
const selectedCard = computed(() => {
  if (!store.canGuess || selectedCardIndex.value === null) return null;
  const card = store.board[selectedCardIndex.value];
  const marked = store.room?.focusedCards.some(
    (marker) => marker.cardIndex === selectedCardIndex.value && marker.playerId === store.playerId
  );
  return card && !card.revealed && marked ? card : null;
});
const hasOwnMarks = computed(() =>
  store.room?.focusedCards.some((marker) => marker.playerId === store.playerId)
);
const waitingHint = computed(() => {
  if (!store.isMyTurn) return t('secret-signals.play.waitingOther');
  if (store.isDirector) return t('secret-signals.play.agentsGuessingYours');
  return t('secret-signals.play.waitingDirector');
});
function handleCardPress(cardIndex: number) {
  if (!store.canGuess || props.pending || store.board[cardIndex]?.revealed) return;
  selectedCardIndex.value = cardIndex;
  const marked = store.room?.focusedCards.some(
    (marker) => marker.cardIndex === cardIndex && marker.playerId === store.playerId
  );
  if (!marked) emit('focus-card', cardIndex);
}
function revealSelected() {
  if (!selectedCard.value || selectedCardIndex.value === null || props.pending) return;
  emit('reveal-card', selectedCardIndex.value);
}
function clearMarks() {
  selectedCardIndex.value = null;
  emit('focus-card', null);
}
watch([() => store.room?.currentTurnTeam, () => store.room?.turnPhase, () => store.phase], () => {
  selectedCardIndex.value = null;
});
</script>

<template>
  <main class="signals-game">
    <TurnIndicator />
    <div class="gameplay-content">
      <div class="signal-strip">
        <div
          v-if="store.currentSignal && store.room?.turnPhase === 'guessing'"
          class="signal-clue"
          role="status"
        >
          <strong>{{ store.currentSignal.word }}</strong>
          <span class="signal-number">{{ store.currentSignal.number }}</span>
          <span class="signal-progress">{{
            t('secret-signals.turn.guessesUsed', {
              count: store.currentSignal.guessesUsed,
              total: store.currentSignal.number === 0 ? '∞' : store.currentSignal.number + 1,
            })
          }}</span>
        </div>
        <p v-else class="signal-waiting">{{ t('secret-signals.turn.directorThinking') }}</p>
        <span v-if="store.currentPlayer?.role" class="your-role">{{
          t(`secret-signals.roles.${store.currentPlayer.role}`)
        }}</span>
      </div>

      <GameBoard :disabled="pending" @card-press="handleCardPress" />

      <section class="action-dock" :aria-label="t('secret-signals.play.actions')">
        <SignalInput
          v-if="store.canGiveSignal"
          :disabled="pending"
          :team-color="store.myTeam"
          @give-signal="(word, number) => emit('give-signal', word, number)"
        />
        <template v-else-if="store.canGuess">
          <p class="selection-hint" aria-live="polite">
            <template v-if="selectedCard"
              >{{ t('secret-signals.play.selected') }}
              <strong>{{ selectedCard.word }}</strong></template
            >
            <template v-else>{{ t('secret-signals.play.tapToMark') }}</template>
          </p>
          <div class="guess-actions">
            <button
              type="button"
              class="ui-btn-primary reveal-action"
              :disabled="!selectedCard || pending"
              @click="revealSelected"
            >
              {{ t('secret-signals.play.revealCard') }}
            </button>
            <button
              type="button"
              class="ui-btn-secondary"
              :disabled="pending"
              @click="emit('end-turn')"
            >
              {{ t('secret-signals.play.endTurn') }}
            </button>
            <button
              v-if="hasOwnMarks"
              type="button"
              class="clear-action"
              :disabled="pending"
              @click="clearMarks"
            >
              {{ t('secret-signals.play.clearMarks') }}
            </button>
          </div>
        </template>
        <p v-else class="waiting-hint" role="status">{{ waitingHint }}</p>
      </section>

      <div class="game-details">
        <details class="table-details">
          <summary>{{ t('secret-signals.play.teamsAndRoles') }}</summary>
          <div class="roster-grid">
            <TeamRosterPanel
              v-for="team in rosterTeams"
              :key="team.color"
              :team-color="team.color"
              :players="team.players"
              :is-current-turn="store.room?.currentTurnTeam === team.color"
              :eliminated="team.eliminated"
            />
          </div>
        </details>
        <details class="table-details">
          <summary>{{ t('secret-signals.log.title') }}</summary>
          <GameLog />
        </details>
        <details v-if="store.isHost" class="table-details host-details">
          <summary>{{ t('secret-signals.play.hostControls') }}</summary>
          <button
            type="button"
            class="ui-btn-secondary"
            :disabled="pending"
            @click="emit('skip-guess-round')"
          >
            {{ t('secret-signals.play.skipTurn') }}
          </button>
        </details>
      </div>
    </div>
  </main>
</template>

<style scoped>
.signals-game {
  background: #102d35;
  color: #f4f7f6;
  min-height: calc(100dvh - 3.5rem);
  padding-bottom: max(1rem, env(safe-area-inset-bottom));
}
.gameplay-content {
  width: 100%;
  max-width: 60rem;
  min-width: 0;
  margin-inline: auto;
  padding: 0 1rem 1rem;
}
.signal-strip {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.5rem;
  min-height: 3.5rem;
  padding-block: 0.5rem 0.75rem;
}
.signal-clue {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 0.5rem;
  min-width: 0;
}
.signal-clue strong {
  font-size: clamp(1.2rem, 5vw, 1.8rem);
  font-weight: 800;
  text-transform: uppercase;
  overflow-wrap: anywhere;
}
.signal-number {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.1rem 0.55rem;
  background: #f2e8d5;
  color: #07171c;
  border-radius: 0.3rem;
  font-size: 1.3rem;
  font-weight: 800;
}
.signal-progress,
.your-role,
.signal-waiting {
  color: #c5d9dc;
  font-size: 0.75rem;
}
.your-role {
  padding: 0.25rem 0.5rem;
  border: 1px solid #47717b;
  border-radius: 0.3rem;
}
.action-dock {
  margin-top: 0.9rem;
  padding: 0.85rem;
  border: 1px solid #47717b;
  border-radius: 0.6rem;
  background: #163943;
}
.selection-hint {
  font-size: 0.85rem;
  margin-bottom: 0.65rem;
  color: #d5e3e5;
  overflow-wrap: anywhere;
}
.selection-hint strong {
  color: #fff;
  text-transform: uppercase;
}
.guess-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-items: stretch;
  gap: 0.5rem;
}
.guess-actions button {
  min-width: 0;
  min-height: 44px;
  white-space: normal;
  overflow-wrap: anywhere;
}
.reveal-action {
  flex: 1;
  background: #f2e8d5;
  color: #07171c;
  border-color: #f2e8d5;
}
.reveal-action:hover:not(:disabled) {
  background: #fff6e6;
}
.clear-action {
  grid-column: 1 / -1;
  color: #d5e3e5;
  font-size: 0.75rem;
  text-decoration: underline;
  text-underline-offset: 3px;
  padding: 0.4rem;
}
.waiting-hint {
  color: #d5e3e5;
  font-size: 0.875rem;
}
.game-details {
  margin-top: 1rem;
  display: grid;
  gap: 0.5rem;
}
.table-details {
  min-width: 0;
  border-top: 1px solid #47717b;
}
summary {
  min-height: 44px;
  padding-block: 0.75rem;
  font-size: 0.8rem;
  font-weight: 600;
  color: #d5e3e5;
  cursor: pointer;
}
summary:focus-visible,
.clear-action:focus-visible {
  outline: 2px solid #f2e8d5;
  outline-offset: 2px;
}
.roster-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 12rem), 1fr));
  gap: 0.75rem;
  padding-bottom: 0.75rem;
}
.host-details button {
  margin-bottom: 0.75rem;
}
@media (max-width: 380px) {
  .gameplay-content {
    padding-inline: 0.6rem;
  }
  .action-dock {
    padding: 0.65rem;
  }
}
</style>
