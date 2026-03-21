<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useGameStore } from '../stores/game';
import TurnIndicator from './TurnIndicator.vue';
import GameBoard from './GameBoard.vue';
import SignalInput from './SignalInput.vue';
import GameLog from './GameLog.vue';
import TeamRosterPanel from './TeamRosterPanel.vue';

const store = useGameStore();
const confirmCardIndex = ref<number | null>(null);

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

const leftRosterTeams = computed(() =>
  rosterTeams.value.slice(0, Math.ceil(rosterTeams.value.length / 2))
);

const rightRosterTeams = computed(() =>
  rosterTeams.value.slice(Math.ceil(rosterTeams.value.length / 2))
);

const confirmCard = computed(() =>
  confirmCardIndex.value === null ? null : (store.board[confirmCardIndex.value] ?? null)
);

function handleCardPress(cardIndex: number) {
  const card = store.board[cardIndex];
  if (!card || card.revealed || !store.room) return;

  const isMyMarkedCard = store.room.focusedCards.some(
    (marker) => marker.cardIndex === cardIndex && marker.playerId === store.playerId
  );

  if (isMyMarkedCard && store.canGuess) {
    confirmCardIndex.value = cardIndex;
    return;
  }

  confirmCardIndex.value = null;
  emit('focus-card', cardIndex);
}

function handleConfirmReveal() {
  if (confirmCardIndex.value === null) return;
  emit('reveal-card', confirmCardIndex.value);
  confirmCardIndex.value = null;
}

watch(
  () => [store.room?.focusedCards, store.room?.turnPhase, store.phase, store.canGuess],
  () => {
    if (confirmCardIndex.value === null) return;
    const isStillMyMarkedCard = (store.room?.focusedCards ?? []).some(
      (marker) => marker.cardIndex === confirmCardIndex.value && marker.playerId === store.playerId
    );
    if (!store.canGuess || !isStillMyMarkedCard) {
      confirmCardIndex.value = null;
    }
  }
);
</script>

<template>
  <div class="game-play">
    <TurnIndicator />

    <div class="game-content">
      <div class="board-area">
        <div class="table-layout">
          <aside class="roster-column">
            <TeamRosterPanel
              v-for="team in leftRosterTeams"
              :key="team.color"
              :team-color="team.color"
              :players="team.players"
              :is-current-turn="store.room?.currentTurnTeam === team.color"
              :eliminated="team.eliminated"
            />
          </aside>

          <div class="board-stack">
            <div
              v-if="store.isDirector && store.isMyTurn && store.room?.turnPhase === 'guessing'"
              class="director-waiting"
            >
              Your agents are guessing...
            </div>
            <div v-if="store.isDirector && !store.isMyTurn" class="director-waiting">
              Waiting for other team...
            </div>

            <GameBoard @card-press="handleCardPress" />

            <div v-if="store.canGiveSignal" class="signal-area">
              <SignalInput
                :disabled="!store.canGiveSignal"
                :team-color="store.myTeam"
                @give-signal="(w, n) => emit('give-signal', w, n)"
              />
            </div>

            <div v-if="store.canEndTurn" class="end-turn-area">
              <button class="btn btn-end-turn" @click="emit('end-turn')">End Turn</button>
            </div>

            <div v-if="store.isHost && store.room?.turnPhase" class="skip-turn-area">
              <button class="btn btn-skip-round" @click="emit('skip-guess-round')">
                Skip Turn
              </button>
            </div>

            <div
              v-if="store.isAgent && store.isMyTurn && store.room?.turnPhase === 'giving-signal'"
              class="agent-waiting"
            >
              Waiting for your Director's signal...
            </div>

            <div v-if="!store.isMyTurn && store.isAgent" class="agent-waiting">
              Waiting for other team...
            </div>
          </div>

          <aside class="roster-column">
            <TeamRosterPanel
              v-for="team in rightRosterTeams"
              :key="team.color"
              :team-color="team.color"
              :players="team.players"
              :is-current-turn="store.room?.currentTurnTeam === team.color"
              :eliminated="team.eliminated"
            />
          </aside>
        </div>
      </div>

      <div class="log-sidebar">
        <GameLog />
      </div>
    </div>

    <Teleport to="body">
      <div v-if="confirmCard" class="confirm-overlay" @click.self="confirmCardIndex = null">
        <div class="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
          <p class="confirm-label">Confirm Reveal</p>
          <h3 id="confirm-title" class="confirm-word">{{ confirmCard.word }}</h3>
          <p class="confirm-copy">This card is only marked so far. Reveal it for the whole room?</p>
          <div class="confirm-actions">
            <button class="btn btn-cancel" @click="confirmCardIndex = null">Keep Marked</button>
            <button class="btn btn-confirm" @click="handleConfirmReveal">Reveal Card</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.game-play {
  display: flex;
  flex-direction: column;
  min-height: 100dvh;
  background: #09090b;
}

.game-content {
  display: flex;
  flex: 1;
}

.board-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 1.5rem 1rem;
}

.table-layout {
  display: grid;
  grid-template-columns: minmax(180px, 220px) minmax(0, 1fr) minmax(180px, 220px);
  gap: 1rem;
  align-items: start;
  width: 100%;
  max-width: 1280px;
}

.roster-column {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.board-stack {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.log-sidebar {
  width: 240px;
  flex-shrink: 0;
}

.signal-area {
  margin-top: 0.5rem;
}

.end-turn-area {
  margin-top: 0.5rem;
}

.skip-turn-area {
  margin-top: -0.25rem;
}

.btn-end-turn {
  padding: 0.6rem 1.5rem;
  border: 2px solid #3f3f46;
  border-radius: 8px;
  background: transparent;
  color: #d4d4d8;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-end-turn:hover,
.btn-skip-round:hover {
  border-color: #8b5cf6;
  color: #fff;
}

.btn-skip-round {
  padding: 0.55rem 1.2rem;
  border: 1px solid #52525b;
  border-radius: 999px;
  background: transparent;
  color: #a1a1aa;
  font-size: 0.82rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
}

.director-waiting,
.agent-waiting {
  color: #71717a;
  font-size: 0.9rem;
  font-style: italic;
}

.confirm-overlay {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  background: rgba(9, 9, 11, 0.78);
  backdrop-filter: blur(8px);
  z-index: 90;
}

.confirm-dialog {
  position: relative;
  isolation: isolate;
  overflow: hidden;
  width: min(440px, calc(100vw - 2rem));
  padding: 1.35rem;
  border: 1px solid #3f3f46;
  border-radius: 20px;
  background: #16161a;
  box-shadow: 0 28px 60px rgba(0, 0, 0, 0.48);
  text-align: center;
}

.confirm-label {
  color: #8b5cf6;
  font-size: 0.78rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.confirm-word {
  margin-top: 0.55rem;
  color: #fafafa;
  font-size: clamp(1.6rem, 6vw, 2.5rem);
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  line-height: 1.05;
}

.confirm-copy {
  margin-top: 0.85rem;
  color: #a1a1aa;
  font-size: 1rem;
  line-height: 1.5;
}

.confirm-actions {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 0.65rem;
  margin-top: 1.25rem;
}

.btn-cancel,
.btn-confirm {
  min-width: 160px;
  padding: 0.8rem 1rem;
  border-radius: 12px;
  font-size: 0.98rem;
  font-weight: 800;
  cursor: pointer;
}

.btn-cancel {
  border: 1px solid #3f3f46;
  background: #202027;
  color: #d4d4d8;
}

.btn-confirm {
  border: none;
  background: #ef4444;
  color: #fff;
}

.btn-cancel:hover {
  background: #2a2a33;
}

.btn-confirm:hover {
  background: #dc2626;
}

@media (max-width: 768px) {
  .game-content {
    flex-direction: column;
  }

  .table-layout {
    grid-template-columns: 1fr;
  }

  .roster-column {
    flex-direction: row;
    flex-wrap: wrap;
    width: 100%;
  }

  .log-sidebar {
    width: 100%;
    max-height: 200px;
    border-left: none;
    border-top: 1px solid #27272a;
  }
}
</style>
