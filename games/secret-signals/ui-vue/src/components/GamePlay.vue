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
  <div class="flex flex-col min-h-dvh bg-canvas">
    <TurnIndicator />

    <div class="gameplay-content">
      <div class="gameplay-board-area">
        <div class="gameplay-table-layout">
          <aside class="gameplay-roster-column">
            <TeamRosterPanel
              v-for="team in leftRosterTeams"
              :key="team.color"
              :team-color="team.color"
              :players="team.players"
              :is-current-turn="store.room?.currentTurnTeam === team.color"
              :eliminated="team.eliminated"
            />
          </aside>

          <div class="relative flex flex-col items-center gap-4">
            <div
              v-if="store.isDirector && store.isMyTurn && store.room?.turnPhase === 'guessing'"
              class="text-muted-foreground text-sm italic"
            >
              Your agents are guessing...
            </div>
            <div v-if="store.isDirector && !store.isMyTurn" class="text-muted-foreground text-sm italic">
              Waiting for other team...
            </div>

            <GameBoard @card-press="handleCardPress" />

            <div v-if="store.canGiveSignal" class="mt-2">
              <SignalInput
                :disabled="!store.canGiveSignal"
                :team-color="store.myTeam"
                @give-signal="(w, n) => emit('give-signal', w, n)"
              />
            </div>

            <div v-if="store.canEndTurn" class="mt-2">
              <button class="ui-btn-secondary hover:!border-signals hover:!text-signals" @click="emit('end-turn')">End Turn</button>
            </div>

            <div v-if="store.isHost && store.room?.turnPhase" class="-mt-1">
              <button class="ui-btn-ghost !text-xs !rounded-full !border !border-border-strong hover:!border-signals !text-muted hover:!text-foreground" @click="emit('skip-guess-round')">
                Skip Turn
              </button>
            </div>

            <div
              v-if="store.isAgent && store.isMyTurn && store.room?.turnPhase === 'giving-signal'"
              class="text-muted-foreground text-sm italic"
            >
              Waiting for your Director's signal...
            </div>

            <div v-if="!store.isMyTurn && store.isAgent" class="text-muted-foreground text-sm italic">
              Waiting for other team...
            </div>
          </div>

          <aside class="gameplay-roster-column">
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

      <div class="gameplay-log-sidebar">
        <GameLog />
      </div>
    </div>

    <Teleport to="body">
      <div v-if="confirmCard" class="ui-overlay !z-90" @click.self="confirmCardIndex = null">
        <div class="ui-dialog !max-w-[440px] !p-5" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
          <p class="text-signals text-xs font-extrabold uppercase tracking-[0.1em]">Confirm Reveal</p>
          <h3 id="confirm-title" class="mt-2 text-foreground text-[clamp(1.6rem,6vw,2.5rem)] font-black uppercase tracking-[0.08em] leading-tight">{{ confirmCard.word }}</h3>
          <p class="mt-3 text-muted text-base leading-relaxed">This card is only marked so far. Reveal it for the whole room?</p>
          <div class="flex justify-center flex-wrap gap-2.5 mt-5">
            <button class="ui-btn-secondary min-w-40 !py-3 !font-extrabold" @click="confirmCardIndex = null">Keep Marked</button>
            <button class="ui-btn-danger min-w-40 !py-3 !font-extrabold" @click="handleConfirmReveal">Reveal Card</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.gameplay-content {
  display: flex;
  flex: 1;
}

.gameplay-board-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 1.5rem 1rem;
}

.gameplay-table-layout {
  display: grid;
  grid-template-columns: minmax(180px, 220px) minmax(0, 1fr) minmax(180px, 220px);
  gap: 1rem;
  align-items: start;
  width: 100%;
  max-width: 1280px;
}

.gameplay-roster-column {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.gameplay-log-sidebar {
  width: 240px;
  flex-shrink: 0;
}

@media (max-width: 768px) {
  .gameplay-content {
    flex-direction: column;
  }

  .gameplay-table-layout {
    grid-template-columns: 1fr;
  }

  .gameplay-roster-column {
    flex-direction: row;
    flex-wrap: wrap;
    width: 100%;
  }

  .gameplay-log-sidebar {
    width: 100%;
    max-height: 200px;
    border-left: none;
    border-top: 1px solid var(--color-border);
  }
}
</style>
