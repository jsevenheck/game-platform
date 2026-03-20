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
  <div class="reveal-phase">
    <div class="round-badge">Round {{ store.room?.roundNumber }}</div>

    <!-- Vote Results -->
    <div class="vote-results">
      <h2 class="section-title">🗳️ Vote Results</h2>
      <div class="tally-list">
        <div
          v-for="(entry, index) in voteTally"
          :key="entry.playerId"
          class="tally-row"
          :class="{
            'top-voted': index === 0,
            'is-infiltrator': entry.isInfiltrator && store.room?.infiltratorIds,
          }"
        >
          <div class="tally-info">
            <span class="tally-name">{{ entry.name }}</span>
            <span v-if="entry.isInfiltrator && store.room?.infiltratorIds" class="badge infiltrator"
              >🕵️ Imposter!</span
            >
          </div>
          <div class="tally-bar-container">
            <div
              class="tally-bar"
              :style="{
                width: `${(entry.votes / (store.connectedPlayers.length || 1)) * 100}%`,
              }"
            ></div>
          </div>
          <span class="tally-count">{{ entry.votes }}</span>
        </div>
      </div>
    </div>

    <!-- Secret Word Reveal -->
    <div v-if="store.room?.secretWord" class="word-reveal">
      <p class="reveal-label">The Secret Word Was</p>
      <h1 class="revealed-word">{{ store.room?.secretWord }}</h1>
    </div>
    <div v-else-if="store.room?.waitingForGuess" class="word-reveal word-hidden">
      <p class="reveal-label">Secret Word</p>
      <h1 class="revealed-word">Hidden Until Guess Ends</h1>
    </div>

    <!-- Infiltrator Identity Reveal -->
    <div v-if="store.room?.infiltratorIds" class="infiltrator-reveal">
      <template v-if="store.room.infiltratorIds.length === 0">
        <div class="paranoia-reveal">
          <h3>😱 Paranoia Mode!</h3>
          <p>There were <strong>no Imposters</strong> this round. Everyone knew the word!</p>
        </div>
      </template>
      <template v-else>
        <h3 class="infiltrator-title">
          {{ store.room.infiltratorIds.length === 1 ? 'The Imposter Was' : 'The Imposters Were' }}
        </h3>
        <div class="infiltrator-names">
          <span
            v-for="id in store.room.infiltratorIds"
            :key="id"
            class="infiltrator-name"
            :class="{ caught: store.room.revealedInfiltrators.includes(id) }"
          >
            {{ getPlayerName(id) }}
            <span v-if="store.room.revealedInfiltrators.includes(id)" class="caught-badge"
              >Caught!</span
            >
            <span v-else class="escaped-badge">Escaped!</span>
          </span>
        </div>
      </template>
    </div>

    <!-- Infiltrator Guess -->
    <div v-if="store.room?.waitingForGuess && store.isCaughtInfiltrator" class="guess-section">
      <h3 class="guess-title">🎯 Last Chance!</h3>
      <p class="guess-hint">You were caught! Guess the secret word to steal the win!</p>
      <div class="guess-input-row">
        <input
          v-model="guess"
          type="text"
          placeholder="Your guess..."
          maxlength="40"
          class="input"
          @keyup.enter="handleGuess"
        />
        <button id="btn-guess-word" class="btn btn-primary" @click="handleGuess">Guess!</button>
      </div>
      <p v-if="guessError" class="error">{{ guessError }}</p>
    </div>

    <div
      v-else-if="store.room?.waitingForGuess && !store.isCaughtInfiltrator"
      class="waiting-guess"
    >
      <p>⏳ Waiting for the Imposter to guess the word...</p>
      <button
        v-if="isHost"
        id="btn-skip-guess"
        class="btn btn-secondary btn-skip"
        @click="$emit('skipGuess')"
      >
        Skip Guess
      </button>
    </div>

    <!-- Round Result -->
    <div v-if="result" class="round-result">
      <div class="result-banner" :class="result.winner">
        <template v-if="result.winner === 'civilians'">
          <h2>👥 Civilians Win!</h2>
          <p v-if="result.infiltratorGuess">
            The imposter guessed "<strong>{{ result.infiltratorGuess }}</strong
            >" — wrong!
          </p>
        </template>
        <template v-else>
          <h2>🕵️ Imposters Win!</h2>
          <p v-if="result.infiltratorGuessCorrect">
            The imposter correctly guessed "<strong>{{ result.infiltratorGuess }}</strong
            >"!
          </p>
          <p v-else-if="!result.infiltratorsCaught">The imposters went undetected!</p>
        </template>
      </div>
    </div>

    <!-- Host Controls -->
    <div v-if="isHost && result" class="host-controls">
      <button id="btn-next-round" class="btn btn-primary" @click="$emit('nextRound')">
        ▶ Next Round
      </button>
      <button id="btn-end-game" class="btn btn-secondary" @click="$emit('endGame')">
        🏆 End Game
      </button>
      <button class="btn btn-secondary" @click="$emit('restartGame')">🏠 Back to Lobby</button>
    </div>
    <p v-else-if="result && !isHost" class="waiting-hint">Waiting for host to continue...</p>
  </div>
</template>

<style scoped>
.reveal-phase {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
  padding: 2rem 1rem;
  min-height: 100dvh;
  background: linear-gradient(135deg, #0f0f23 0%, #1a1a2e 50%, #16213e 100%);
}

.round-badge {
  background: rgba(249, 115, 22, 0.15);
  color: #f97316;
  padding: 0.4rem 1rem;
  border-radius: 20px;
  font-size: 0.85rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  border: 1px solid rgba(249, 115, 22, 0.3);
}

.section-title {
  color: #e2e8f0;
  font-size: 1.1rem;
  margin-bottom: 1rem;
  text-align: center;
}

.vote-results {
  width: 100%;
  max-width: 400px;
}

.tally-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.tally-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.65rem 0.85rem;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  transition: all 0.3s;
}

.tally-row.top-voted {
  border-color: rgba(249, 115, 22, 0.4);
  background: rgba(249, 115, 22, 0.08);
}

.tally-row.is-infiltrator {
  border-color: rgba(239, 68, 68, 0.4);
  background: rgba(239, 68, 68, 0.08);
}

.tally-info {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
}

.tally-name {
  color: #e2e8f0;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.badge.infiltrator {
  font-size: 0.6rem;
  padding: 0.1rem 0.35rem;
  border-radius: 4px;
  background: rgba(239, 68, 68, 0.2);
  color: #ef4444;
  text-transform: uppercase;
  font-weight: 700;
  white-space: nowrap;
}

.tally-bar-container {
  flex: 1;
  height: 6px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 3px;
  overflow: hidden;
}

.tally-bar {
  height: 100%;
  background: linear-gradient(90deg, #f97316, #ef4444);
  border-radius: 3px;
  transition: width 0.5s ease;
}

.tally-count {
  color: #f97316;
  font-weight: 800;
  font-size: 1.1rem;
  min-width: 1.5rem;
  text-align: center;
}

.word-reveal {
  text-align: center;
  padding: 1.5rem 2rem;
  background: rgba(34, 197, 94, 0.05);
  border: 1px solid rgba(34, 197, 94, 0.2);
  border-radius: 16px;
}

.word-hidden {
  background: rgba(249, 115, 22, 0.06);
  border-color: rgba(249, 115, 22, 0.25);
}

.reveal-label {
  color: #64748b;
  font-size: 0.85rem;
  text-transform: uppercase;
  letter-spacing: 0.15em;
  margin-bottom: 0.25rem;
}

.revealed-word {
  font-size: 2.5rem;
  font-weight: 900;
  color: #22c55e;
}

.infiltrator-reveal {
  text-align: center;
  width: 100%;
  max-width: 400px;
}

.paranoia-reveal {
  padding: 1rem;
  background: rgba(168, 85, 247, 0.1);
  border: 1px solid rgba(168, 85, 247, 0.3);
  border-radius: 12px;
}

.paranoia-reveal h3 {
  color: #a855f7;
  margin-bottom: 0.5rem;
}

.paranoia-reveal p {
  color: #94a3b8;
  font-size: 0.9rem;
}

.infiltrator-title {
  color: #94a3b8;
  font-size: 0.95rem;
  margin-bottom: 0.75rem;
}

.infiltrator-names {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  justify-content: center;
}

.infiltrator-name {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.5rem 1rem;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 10px;
  color: #ef4444;
  font-weight: 700;
  font-size: 1.1rem;
}

.caught-badge {
  font-size: 0.65rem;
  padding: 0.1rem 0.3rem;
  border-radius: 4px;
  background: rgba(34, 197, 94, 0.2);
  color: #22c55e;
  text-transform: uppercase;
  font-weight: 700;
}

.escaped-badge {
  font-size: 0.65rem;
  padding: 0.1rem 0.3rem;
  border-radius: 4px;
  background: rgba(249, 115, 22, 0.2);
  color: #f97316;
  text-transform: uppercase;
  font-weight: 700;
}

.guess-section {
  width: 100%;
  max-width: 400px;
  text-align: center;
  padding: 1.25rem;
  background: rgba(239, 68, 68, 0.05);
  border: 2px solid rgba(239, 68, 68, 0.3);
  border-radius: 16px;
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

.guess-title {
  color: #ef4444;
  font-size: 1.2rem;
  margin-bottom: 0.35rem;
}

.guess-hint {
  color: #94a3b8;
  font-size: 0.85rem;
  margin-bottom: 1rem;
}

.guess-input-row {
  display: flex;
  gap: 0.5rem;
  align-items: stretch;
  flex-wrap: wrap;
}

.input {
  flex: 1;
  min-width: 0;
  padding: 0.85rem 1rem;
  border: 2px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.05);
  color: #fff;
  font-size: 1rem;
  outline: none;
  transition: all 0.3s;
}

.input:focus {
  border-color: #ef4444;
}

.error {
  color: #ef4444;
  font-size: 0.8rem;
  margin-top: 0.25rem;
}

.waiting-guess {
  color: #64748b;
  font-style: italic;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
}

.btn-skip {
  font-size: 0.85rem;
  padding: 0.5rem 1.25rem;
}

.round-result {
  width: 100%;
  max-width: 400px;
}

.result-banner {
  text-align: center;
  padding: 1.5rem;
  border-radius: 16px;
  animation: slideIn 0.5s ease;
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

.result-banner.civilians {
  background: rgba(34, 197, 94, 0.1);
  border: 2px solid rgba(34, 197, 94, 0.3);
}

.result-banner.civilians h2 {
  color: #22c55e;
  font-size: 1.5rem;
}

.result-banner.civilians p {
  color: #94a3b8;
  margin-top: 0.5rem;
}

.result-banner.infiltrators {
  background: rgba(239, 68, 68, 0.1);
  border: 2px solid rgba(239, 68, 68, 0.3);
}

.result-banner.infiltrators h2 {
  color: #ef4444;
  font-size: 1.5rem;
}

.result-banner.infiltrators p {
  color: #94a3b8;
  margin-top: 0.5rem;
}

.host-controls {
  display: flex;
  gap: 0.75rem;
  width: 100%;
  max-width: 400px;
}

.host-controls .btn {
  flex: 1;
}

.btn {
  padding: 0.85rem 1.5rem;
  border: none;
  border-radius: 12px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s;
}

.btn-primary {
  background: linear-gradient(135deg, #f97316, #ef4444);
  color: #fff;
  box-shadow: 0 4px 15px rgba(249, 115, 22, 0.3);
}

.btn-primary:hover {
  transform: translateY(-2px);
}

.btn-secondary {
  background: rgba(255, 255, 255, 0.08);
  color: #e2e8f0;
  border: 2px solid rgba(255, 255, 255, 0.15);
}

.btn-secondary:hover {
  border-color: #f97316;
}

.waiting-hint {
  color: #64748b;
  font-style: italic;
}

@media (max-width: 480px) {
  .guess-input-row {
    flex-direction: column;
  }

  .guess-input-row .btn {
    width: 100%;
  }
}
</style>
