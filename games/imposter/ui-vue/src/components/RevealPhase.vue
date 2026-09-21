<script setup lang="ts">
import { ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import ScoreStandings, { type StandingEntry } from '@platform/components/ScoreStandings.vue';
import type { PlayerView } from '@shared/types';
import { useGameStore } from '../stores/game';

const { t } = useI18n();
const store = useGameStore();

const emit = defineEmits<{
  guessWord: [guess: string];
  skipGuess: [];
  nextRound: [];
  endGame: [];
  restartGame: [];
}>();

const guess = ref('');
const guessError = ref('');

const isHost = computed(
  () => store.room?.players.find((p: PlayerView) => p.id === store.playerId)?.isHost ?? false
);

const result = computed(() => store.room?.lastRoundResult ?? null);

function getPlayerName(id: string): string {
  return (
    store.room?.players.find((p: PlayerView) => p.id === id)?.name ?? t('imposter.common.unknown')
  );
}

function handleGuess() {
  const trimmed = guess.value.trim();
  if (!trimmed) {
    guessError.value = t('imposter.reveal.guessEmpty');
    return;
  }
  guessError.value = '';
  emit('guessWord', trimmed);
}

const standings = computed<StandingEntry[]>(() =>
  (store.room?.players ?? []).map((player: PlayerView) => ({
    id: player.id,
    name: player.name,
    points: player.score,
  }))
);
const formatPoints = (points: number) =>
  t(points === 1 ? 'imposter.reveal.point' : 'imposter.reveal.points', { count: points });

const voteTally = computed(() => {
  if (!store.room?.votes) return [];
  const tally: Record<string, number> = {};
  for (const targetId of Object.values(store.room.votes)) {
    tally[targetId] = (tally[targetId] ?? 0) + 1;
  }
  return Object.entries(tally)
    .map(([id, count]) => ({
      playerId: id,
      name: getPlayerName(id),
      votes: count,
      isInfiltrator: store.room?.infiltratorIds?.includes(id) ?? false,
    }))
    .sort((a, b) => b.votes - a.votes);
});
</script>

<template>
  <div
    class="reveal-phase flex flex-col items-center gap-6 px-4 py-8 min-h-dvh bg-linear-to-br from-imposter-gradient-1 via-imposter-gradient-2 to-imposter-gradient-3"
  >
    <div
      class="round-badge bg-imposter-muted text-imposter px-4 py-1.5 rounded-full text-sm font-bold tracking-wide uppercase border border-imposter/30"
    >
      {{ t('imposter.common.round', { round: store.room?.roundNumber }) }}
    </div>

    <div class="w-full max-w-100">
      <h2 class="text-foreground text-lg mb-4 text-center">{{ t('imposter.reveal.results') }}</h2>
      <div class="flex flex-col gap-2">
        <div
          v-for="(entry, index) in voteTally"
          :key="entry.playerId"
          class="flex items-center gap-3 px-3.5 py-2.5 bg-white/4 border border-white/8 rounded-md transition-all"
          :class="{
            'border-imposter/40! bg-imposter/8!': index === 0,
            'border-danger/40! bg-danger/8!': entry.isInfiltrator && store.room?.infiltratorIds,
          }"
        >
          <div class="flex-1 flex items-center gap-2 min-w-0">
            <span class="text-foreground font-medium truncate">{{ entry.name }}</span>
            <span
              v-if="entry.isInfiltrator && store.room?.infiltratorIds"
              class="ui-badge bg-danger-muted text-danger"
              >{{ t('imposter.reveal.imposterBadge') }}</span
            >
          </div>
          <div class="flex-1 h-1.5 bg-white/8 rounded-sm overflow-hidden">
            <div
              class="h-full bg-imposter rounded-sm transition-[width] duration-500"
              :style="{ width: `${(entry.votes / (store.connectedPlayers.length || 1)) * 100}%` }"
            ></div>
          </div>
          <span class="text-imposter font-extrabold text-lg min-w-6 text-center font-mono-num">{{
            entry.votes
          }}</span>
        </div>
      </div>
    </div>

    <div
      v-if="store.room?.secretWord"
      class="text-center px-8 py-6 bg-success-muted border border-success/20 rounded-xl"
    >
      <p class="text-muted-foreground text-sm uppercase tracking-[0.15em] mb-1">
        {{ t('imposter.reveal.wordWas') }}
      </p>
      <h1 class="text-4xl font-black text-success">{{ store.room?.secretWord }}</h1>
    </div>
    <div
      v-else-if="store.room?.waitingForGuess"
      class="word-hidden text-center px-8 py-6 bg-imposter-muted border border-imposter/25 rounded-xl"
    >
      <p class="text-muted-foreground text-sm uppercase tracking-[0.15em] mb-1">
        {{ t('imposter.reveal.secretWord') }}
      </p>
      <h1 class="text-4xl font-black text-imposter">{{ t('imposter.reveal.hidden') }}</h1>
    </div>

    <div v-if="store.room?.infiltratorIds" class="text-center w-full max-w-100">
      <template v-if="store.room.infiltratorIds.length === 0">
        <div class="p-4 bg-blackout-muted border border-blackout/30 rounded-lg">
          <h3 class="text-blackout mb-2">{{ t('imposter.reveal.paranoia') }}</h3>
          <p class="text-muted text-sm">
            <i18n-t keypath="imposter.reveal.noImposters" scope="global">
              <template #none>
                <strong class="text-foreground">{{ t('imposter.reveal.noImpostersBold') }}</strong>
              </template>
            </i18n-t>
          </p>
        </div>
      </template>
      <template v-else>
        <h3 class="text-muted text-sm mb-3">
          {{
            store.room.infiltratorIds.length === 1
              ? t('imposter.reveal.imposterWas')
              : t('imposter.reveal.impostersWere')
          }}
        </h3>
        <div class="flex flex-wrap gap-2 justify-center">
          <span
            v-for="id in store.room.infiltratorIds"
            :key="id"
            class="inline-flex items-center gap-1.5 px-4 py-2 bg-danger/10 border border-danger/30 rounded-md text-danger font-bold text-lg"
          >
            {{ getPlayerName(id) }}
            <span
              v-if="store.room.revealedInfiltrators.includes(id)"
              class="ui-badge bg-success-muted text-success"
              >{{ t('imposter.reveal.caught') }}</span
            >
            <span v-else class="ui-badge bg-imposter-muted text-imposter">{{
              t('imposter.reveal.escaped')
            }}</span>
          </span>
        </div>
      </template>
    </div>

    <div
      v-if="store.room?.waitingForGuess && store.isCaughtInfiltrator"
      class="guess-section w-full max-w-100 text-center p-5 bg-danger/5 border-2 border-danger/30 rounded-xl"
    >
      <h3 class="text-danger text-xl mb-1">{{ t('imposter.reveal.lastChance') }}</h3>
      <p class="text-muted text-sm mb-4">
        {{ t('imposter.reveal.caughtHint') }}
      </p>
      <div class="flex gap-2 flex-wrap">
        <label for="imposter-guess" class="sr-only">{{ t('imposter.reveal.guessLabel') }}</label>
        <input
          id="imposter-guess"
          v-model="guess"
          type="text"
          :placeholder="t('imposter.reveal.guessPlaceholder')"
          maxlength="40"
          class="ui-input guess-input bg-white-5 border-white-10 flex-1 min-w-0"
          @keyup.enter="handleGuess"
        />
        <button
          id="btn-guess-word"
          class="ui-btn-primary btn-imposter btn-imposter-hover"
          @click="handleGuess"
        >
          {{ t('imposter.reveal.guess') }}
        </button>
      </div>
      <p v-if="guessError" role="alert" class="text-danger text-xs mt-1">{{ guessError }}</p>
    </div>

    <div
      v-else-if="store.room?.waitingForGuess && !store.isCaughtInfiltrator"
      class="flex flex-col items-center gap-3 text-muted-foreground italic text-center"
    >
      <p>{{ t('imposter.reveal.waitingForGuess') }}</p>
      <button
        v-if="isHost"
        id="btn-skip-guess"
        class="ui-btn-secondary text-sm px-5 py-2 hover-border-imposter hover-text-imposter"
        @click="$emit('skipGuess')"
      >
        {{ t('imposter.reveal.skipGuess') }}
      </button>
    </div>

    <div v-if="result" class="round-result w-full max-w-100">
      <div
        class="result-banner text-center p-6 rounded-xl animate-[slideIn_0.5s_ease]"
        :class="[
          {
            civilians: result.winner === 'civilians',
            imposters: result.winner !== 'civilians',
          },
          result.winner === 'civilians'
            ? 'bg-success-muted border-2 border-success/30'
            : 'bg-danger-muted border-2 border-danger/30',
        ]"
      >
        <template v-if="result.winner === 'civilians'">
          <h2 class="text-success text-2xl font-bold">{{ t('imposter.reveal.civiliansWin') }}</h2>
          <p v-if="result.infiltratorGuess" class="text-muted mt-2">
            {{ t('imposter.reveal.guessedWrong', { guess: result.infiltratorGuess }) }}
          </p>
        </template>
        <template v-else>
          <h2 class="text-danger text-2xl font-bold">{{ t('imposter.reveal.impostersWin') }}</h2>
          <p v-if="result.infiltratorGuessCorrect" class="text-muted mt-2">
            {{ t('imposter.reveal.guessedRight', { guess: result.infiltratorGuess }) }}
          </p>
          <p v-else-if="!result.infiltratorsCaught" class="text-muted mt-2">
            {{ t('imposter.reveal.undetected') }}
          </p>
        </template>
      </div>
    </div>

    <ScoreStandings
      v-if="result"
      class="w-full max-w-100"
      :entries="standings"
      :my-id="store.playerId ?? undefined"
      :format-points="formatPoints"
      :title="t('imposter.reveal.standings', { score: store.room?.targetScore })"
      test-id="imposter-standings"
    />

    <div v-if="isHost && result" class="flex gap-3 w-full max-w-100">
      <button
        id="btn-next-round"
        class="ui-btn-primary btn-imposter btn-imposter-hover flex-1"
        @click="$emit('nextRound')"
      >
        {{ t('imposter.reveal.nextRound') }}
      </button>
      <button
        id="btn-end-game"
        class="ui-btn-secondary hover-border-imposter hover-text-imposter flex-1"
        @click="$emit('endGame')"
      >
        {{ t('imposter.reveal.endGame') }}
      </button>
      <button
        class="ui-btn-secondary hover-border-imposter hover-text-imposter flex-1"
        @click="$emit('restartGame')"
      >
        {{ t('imposter.reveal.backToLobby') }}
      </button>
    </div>
    <p v-else-if="result && !isHost" class="text-muted-foreground italic">
      {{ t('imposter.reveal.waitingForHost') }}
    </p>
  </div>
</template>

<style scoped>
.guess-input:focus {
  border-color: var(--color-danger);
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(20px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.guess-section {
  animation: glow 2s ease-in-out infinite;
}

@keyframes glow {
  0%,
  100% {
    box-shadow: 0 0 10px rgba(239, 68, 68, 0.1);
  }

  50% {
    box-shadow: 0 0 25px rgba(239, 68, 68, 0.2);
  }
}
.btn-imposter {
  background: var(--color-imposter);
}
.btn-imposter-hover:hover:not(:disabled) {
  background: var(--color-imposter-hover);
}
.hover-border-imposter:hover {
  border-color: var(--color-imposter);
}
.hover-text-imposter:hover {
  color: var(--color-imposter);
}
.focus-border-imposter:focus {
  border-color: var(--color-imposter);
}
.bg-white-5 {
  background: rgba(255, 255, 255, 0.05);
}
.border-white-10 {
  border-color: rgba(255, 255, 255, 0.1);
}
.signals-active {
  border-color: var(--color-imposter);
  background: rgba(239, 68, 68, 0.1);
}
</style>
