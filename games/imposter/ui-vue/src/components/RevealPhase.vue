<script setup lang="ts">
import { ref, computed } from 'vue';
import type { PlayerView } from '@shared/types';
import { useGameStore } from '../stores/game';

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
  return store.room?.players.find((p: PlayerView) => p.id === id)?.name ?? 'Unknown';
}

function handleGuess() {
  const trimmed = guess.value.trim();
  if (!trimmed) {
    guessError.value = 'Enter a guess';
    return;
  }
  guessError.value = '';
  emit('guessWord', trimmed);
}

// Vote tally for display
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
  <div class="flex flex-col items-center gap-6 px-4 py-8 min-h-dvh bg-gradient-to-br from-imposter-gradient-1 via-imposter-gradient-2 to-imposter-gradient-3">
    <div class="bg-imposter-muted text-imposter px-4 py-1.5 rounded-full text-sm font-bold tracking-wide uppercase border border-imposter/30">
      Round {{ store.room?.roundNumber }}
    </div>

    <!-- Vote Results -->
    <div class="w-full max-w-[400px]">
      <h2 class="text-foreground text-lg mb-4 text-center">Vote Results</h2>
      <div class="flex flex-col gap-2">
        <div
          v-for="(entry, index) in voteTally"
          :key="entry.playerId"
          class="flex items-center gap-3 px-3.5 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-[--radius-md] transition-all"
          :class="{
            '!border-imposter/40 !bg-imposter/[0.08]': index === 0,
            '!border-danger/40 !bg-danger/[0.08]': entry.isInfiltrator && store.room?.infiltratorIds,
          }"
        >
          <div class="flex-1 flex items-center gap-2 min-w-0">
            <span class="text-foreground font-medium truncate">{{ entry.name }}</span>
            <span v-if="entry.isInfiltrator && store.room?.infiltratorIds" class="ui-badge bg-danger-muted text-danger">Imposter!</span>
          </div>
          <div class="flex-1 h-1.5 bg-white/[0.08] rounded-sm overflow-hidden">
            <div class="h-full bg-imposter rounded-sm transition-[width] duration-500" :style="{ width: `${(entry.votes / (store.connectedPlayers.length || 1)) * 100}%` }"></div>
          </div>
          <span class="text-imposter font-extrabold text-lg min-w-[1.5rem] text-center">{{ entry.votes }}</span>
        </div>
      </div>
    </div>

    <!-- Secret Word Reveal -->
    <div v-if="store.room?.secretWord" class="text-center px-8 py-6 bg-success-muted border border-success/20 rounded-[--radius-xl]">
      <p class="text-muted-foreground text-sm uppercase tracking-[0.15em] mb-1">The Secret Word Was</p>
      <h1 class="text-4xl font-black text-success">{{ store.room?.secretWord }}</h1>
    </div>
    <div v-else-if="store.room?.waitingForGuess" class="text-center px-8 py-6 bg-imposter-muted border border-imposter/25 rounded-[--radius-xl]">
      <p class="text-muted-foreground text-sm uppercase tracking-[0.15em] mb-1">Secret Word</p>
      <h1 class="text-4xl font-black text-imposter">Hidden Until Guess Ends</h1>
    </div>

    <!-- Infiltrator Identity Reveal -->
    <div v-if="store.room?.infiltratorIds" class="text-center w-full max-w-[400px]">
      <template v-if="store.room.infiltratorIds.length === 0">
        <div class="p-4 bg-blackout-muted border border-blackout/30 rounded-[--radius-lg]">
          <h3 class="text-blackout mb-2">Paranoia Mode!</h3>
          <p class="text-muted text-sm">There were <strong class="text-foreground">no Imposters</strong> this round. Everyone knew the word!</p>
        </div>
      </template>
      <template v-else>
        <h3 class="text-muted text-sm mb-3">
          {{ store.room.infiltratorIds.length === 1 ? 'The Imposter Was' : 'The Imposters Were' }}
        </h3>
        <div class="flex flex-wrap gap-2 justify-center">
          <span
            v-for="id in store.room.infiltratorIds"
            :key="id"
            class="inline-flex items-center gap-1.5 px-4 py-2 bg-danger/10 border border-danger/30 rounded-[--radius-md] text-danger font-bold text-lg"
          >
            {{ getPlayerName(id) }}
            <span v-if="store.room.revealedInfiltrators.includes(id)" class="ui-badge bg-success-muted text-success">Caught!</span>
            <span v-else class="ui-badge bg-imposter-muted text-imposter">Escaped!</span>
          </span>
        </div>
      </template>
    </div>

    <!-- Infiltrator Guess -->
    <div v-if="store.room?.waitingForGuess && store.isCaughtInfiltrator" class="guess-section w-full max-w-[400px] text-center p-5 bg-danger/5 border-2 border-danger/30 rounded-[--radius-xl]">
      <h3 class="text-danger text-xl mb-1">Last Chance!</h3>
      <p class="text-muted text-sm mb-4">You were caught! Guess the secret word to steal the win!</p>
      <div class="flex gap-2 flex-wrap">
        <input
          v-model="guess"
          type="text"
          placeholder="Your guess..."
          maxlength="40"
          class="ui-input !bg-white/5 !border-white/10 focus:!border-danger flex-1 min-w-0"
          @keyup.enter="handleGuess"
        />
        <button id="btn-guess-word" class="ui-btn-primary !bg-imposter hover:!bg-imposter-hover" @click="handleGuess">Guess!</button>
      </div>
      <p v-if="guessError" class="text-danger text-xs mt-1">{{ guessError }}</p>
    </div>

    <div
      v-else-if="store.room?.waitingForGuess && !store.isCaughtInfiltrator"
      class="flex flex-col items-center gap-3 text-muted-foreground italic text-center"
    >
      <p>Waiting for the Imposter to guess the word...</p>
      <button
        v-if="isHost"
        id="btn-skip-guess"
        class="ui-btn-secondary !text-sm !px-5 !py-2 hover:!border-imposter hover:!text-imposter"
        @click="$emit('skipGuess')"
      >
        Skip Guess
      </button>
    </div>

    <!-- Round Result -->
    <div v-if="result" class="w-full max-w-[400px]">
      <div
        class="text-center p-6 rounded-[--radius-xl] animate-[slideIn_0.5s_ease]"
        :class="result.winner === 'civilians' ? 'bg-success-muted border-2 border-success/30' : 'bg-danger-muted border-2 border-danger/30'"
      >
        <template v-if="result.winner === 'civilians'">
          <h2 class="text-success text-2xl font-bold">Civilians Win!</h2>
          <p v-if="result.infiltratorGuess" class="text-muted mt-2">
            The imposter guessed "<strong class="text-foreground">{{ result.infiltratorGuess }}</strong>" — wrong!
          </p>
        </template>
        <template v-else>
          <h2 class="text-danger text-2xl font-bold">Imposters Win!</h2>
          <p v-if="result.infiltratorGuessCorrect" class="text-muted mt-2">
            The imposter correctly guessed "<strong class="text-foreground">{{ result.infiltratorGuess }}</strong>"!
          </p>
          <p v-else-if="!result.infiltratorsCaught" class="text-muted mt-2">The imposters went undetected!</p>
        </template>
      </div>
    </div>

    <!-- Host Controls -->
    <div v-if="isHost && result" class="flex gap-3 w-full max-w-[400px]">
      <button id="btn-next-round" class="ui-btn-primary !bg-imposter hover:!bg-imposter-hover flex-1" @click="$emit('nextRound')">
        Next Round
      </button>
      <button id="btn-end-game" class="ui-btn-secondary hover:!border-imposter hover:!text-imposter flex-1" @click="$emit('endGame')">
        End Game
      </button>
      <button class="ui-btn-secondary hover:!border-imposter hover:!text-imposter flex-1" @click="$emit('restartGame')">Back to Lobby</button>
    </div>
    <p v-else-if="result && !isHost" class="text-muted-foreground italic">Waiting for host to continue...</p>
  </div>
</template>

<style scoped>
@keyframes slideIn {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

.guess-section {
  animation: glow 2s ease-in-out infinite;
}

@keyframes glow {
  0%, 100% { box-shadow: 0 0 10px rgba(239, 68, 68, 0.1); }
  50% { box-shadow: 0 0 25px rgba(239, 68, 68, 0.2); }
}
</style>
