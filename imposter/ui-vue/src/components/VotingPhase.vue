<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import type { PlayerView } from '@shared/types';
import { useGameStore } from '../stores/game';

const store = useGameStore();

const emit = defineEmits<{
  submitVote: [targetId: string];
}>();

const selectedTarget = ref<string | null>(null);
const now = ref(Date.now());
let timerInterval: ReturnType<typeof setInterval> | null = null;

onMounted(() => {
  timerInterval = setInterval(() => {
    now.value = Date.now();
  }, 1000);
});

onUnmounted(() => {
  if (timerInterval) clearInterval(timerInterval);
});

const isDiscussion = computed(() => store.phase === 'discussion');
const isVoting = computed(() => store.phase === 'voting');

const timeRemaining = computed(() => {
  if (!store.room?.discussionEndsAt) return 0;
  return Math.max(0, Math.ceil((store.room.discussionEndsAt - now.value) / 1000));
});

const timerPercent = computed(() => {
  return (
    (timeRemaining.value /
      (store.room?.discussionDurationMs ? store.room.discussionDurationMs / 1000 : 1)) *
    100
  );
});

const orderedPlayers = computed(() => {
  if (!store.room) {
    return [];
  }

  const playersById = new Map(store.room.players.map((player) => [player.id, player]));
  return store.room.descriptionOrder
    .map((playerId) => playersById.get(playerId))
    .filter((player): player is PlayerView => Boolean(player));
});

const otherPlayers = computed(() => {
  return (
    store.room?.players.filter((p: PlayerView) => p.id !== store.playerId && p.connected) ?? []
  );
});

function handleVote() {
  if (!selectedTarget.value || store.hasVoted) return;
  emit('submitVote', selectedTarget.value);
}

function getDescriptionText(playerId: string): string {
  const description = store.room?.descriptions?.[playerId];
  if (description === '') {
    return 'Skipped by host';
  }
  return description ?? '...';
}
</script>

<template>
  <div class="voting-phase">
    <div class="round-badge">Round {{ store.room?.roundNumber }}</div>

    <!-- Descriptions display -->
    <div class="descriptions-section">
      <h2 class="section-title">📝 Descriptions</h2>
      <div class="descriptions-grid">
        <div
          v-for="player in orderedPlayers"
          :key="player.id"
          class="description-card"
          :class="{ 'is-me': player.id === store.playerId }"
        >
          <div class="description-header">
            <span class="player-name">{{ player.name }}</span>
            <span v-if="player.id === store.playerId" class="badge me">You</span>
          </div>
          <p class="description-text">
            {{ getDescriptionText(player.id) }}
          </p>
        </div>
      </div>
      <p class="descriptions-hint">
        Clues are shown in the shared round order so everyone reads the same list.
      </p>
    </div>

    <!-- Discussion Timer -->
    <div v-if="isDiscussion" class="discussion-section">
      <h2 class="section-title">💬 Discussion Time</h2>
      <div class="timer-container">
        <div class="timer-ring">
          <svg viewBox="0 0 100 100" class="timer-svg">
            <circle cx="50" cy="50" r="42" class="timer-track" />
            <circle
              cx="50"
              cy="50"
              r="42"
              class="timer-progress"
              :style="{
                strokeDasharray: `${timerPercent * 2.64} 264`,
                stroke: timeRemaining < 10 ? '#ef4444' : '#f97316',
              }"
            />
          </svg>
          <span class="timer-text" :class="{ urgent: timeRemaining < 10 }">
            {{ timeRemaining }}
          </span>
        </div>
        <p class="timer-hint">Discuss who might be the Imposter!</p>
      </div>
    </div>

    <!-- Voting -->
    <div v-if="isVoting" class="voting-section">
      <h2 class="section-title">🗳️ Cast Your Vote</h2>

      <div v-if="!store.hasVoted" class="vote-options">
        <button
          v-for="player in otherPlayers"
          :key="player.id"
          class="vote-btn"
          :class="{ selected: selectedTarget === player.id }"
          @click="selectedTarget = player.id"
        >
          <span class="vote-name">{{ player.name }}</span>
          <span v-if="selectedTarget === player.id" class="vote-check">✓</span>
        </button>
        <button
          id="btn-confirm-vote"
          class="btn btn-primary btn-vote"
          :disabled="!selectedTarget"
          @click="handleVote"
        >
          Confirm Vote
        </button>
      </div>

      <div v-else class="vote-submitted">
        <p class="check">✅ Vote submitted!</p>
      </div>

      <div class="vote-progress">
        <p class="progress-text">
          {{ store.room?.submittedVoteIds.length ?? 0 }} / {{ store.connectedPlayers.length }} voted
        </p>
        <div class="progress-bar">
          <div
            class="progress-fill"
            :style="{
              width: `${((store.room?.submittedVoteIds.length ?? 0) / (store.connectedPlayers.length || 1)) * 100}%`,
            }"
          ></div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.voting-phase {
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

.descriptions-section {
  width: 100%;
  max-width: 400px;
}

.descriptions-grid {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.descriptions-hint {
  color: #64748b;
  font-size: 0.8rem;
  margin-top: 0.75rem;
  text-align: center;
}

.description-card {
  padding: 0.75rem 1rem;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  transition: all 0.2s;
}

.description-card.is-me {
  border-color: rgba(249, 115, 22, 0.3);
  background: rgba(249, 115, 22, 0.05);
}

.description-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.35rem;
}

.player-name {
  color: #94a3b8;
  font-size: 0.8rem;
  font-weight: 600;
}

.badge.me {
  font-size: 0.6rem;
  padding: 0.1rem 0.35rem;
  border-radius: 4px;
  background: rgba(249, 115, 22, 0.2);
  color: #f97316;
  text-transform: uppercase;
  font-weight: 700;
}

.description-text {
  color: #e2e8f0;
  font-size: 1rem;
  font-weight: 500;
}

.discussion-section {
  width: 100%;
  max-width: 400px;
}

.timer-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.timer-ring {
  position: relative;
  width: 120px;
  height: 120px;
}

.timer-svg {
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
}

.timer-track {
  fill: none;
  stroke: rgba(255, 255, 255, 0.08);
  stroke-width: 6;
}

.timer-progress {
  fill: none;
  stroke-width: 6;
  stroke-linecap: round;
  transition: stroke-dasharray 1s linear;
}

.timer-text {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 2.5rem;
  font-weight: 900;
  color: #f97316;
}

.timer-text.urgent {
  color: #ef4444;
  animation: pulse 1s ease-in-out infinite;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

.timer-hint {
  color: #64748b;
  font-size: 0.85rem;
  font-style: italic;
}

.voting-section {
  width: 100%;
  max-width: 400px;
}

.vote-options {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.vote-btn {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.85rem 1rem;
  background: rgba(255, 255, 255, 0.04);
  border: 2px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s;
  color: #e2e8f0;
  font-size: 1rem;
}

.vote-btn:hover {
  border-color: rgba(249, 115, 22, 0.4);
  background: rgba(249, 115, 22, 0.05);
}

.vote-btn.selected {
  border-color: #f97316;
  background: rgba(249, 115, 22, 0.1);
}

.vote-name {
  font-weight: 500;
}

.vote-check {
  color: #f97316;
  font-weight: 700;
  font-size: 1.2rem;
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

.btn-primary:hover:not(:disabled) {
  transform: translateY(-2px);
}

.btn-primary:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.btn-vote {
  margin-top: 0.75rem;
  width: 100%;
  padding: 1rem;
}

.vote-submitted {
  text-align: center;
  padding: 1rem;
  background: rgba(34, 197, 94, 0.1);
  border: 1px solid rgba(34, 197, 94, 0.2);
  border-radius: 12px;
}

.check {
  color: #22c55e;
  font-weight: 600;
}

.vote-progress {
  margin-top: 1rem;
  text-align: center;
}

.progress-text {
  color: #64748b;
  font-size: 0.8rem;
  margin-bottom: 0.5rem;
}

.progress-bar {
  height: 6px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #f97316, #ef4444);
  border-radius: 3px;
  transition: width 0.5s ease;
}
</style>
