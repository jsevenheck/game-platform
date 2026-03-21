<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { PlayerView } from '@shared/types';
import { useGameStore } from '../stores/game';

const store = useGameStore();

const emit = defineEmits<{
  submitDescription: [description: string];
  skipDescriptionTurn: [];
}>();

const description = ref('');
const error = ref('');

const orderedPlayers = computed(() => {
  if (!store.room) {
    return [];
  }

  const playersById = new Map(store.room.players.map((player) => [player.id, player]));
  return store.room.descriptionOrder
    .map((playerId) => playersById.get(playerId))
    .filter((player): player is PlayerView => Boolean(player));
});
const myDescription = computed(() =>
  store.playerId && store.room?.descriptions ? store.room.descriptions[store.playerId] : undefined
);
const wasSkipped = computed(() => myDescription.value === '');
const currentDescriber = computed(
  () =>
    store.room?.players.find(
      (player: PlayerView) => player.id === store.room?.currentDescriberId
    ) ?? null
);
const isMyTurn = computed(() => store.room?.currentDescriberId === store.playerId);

watch(
  () => store.room?.currentDescriberId,
  (currentDescriberId) => {
    if (currentDescriberId === store.playerId) {
      error.value = '';
      description.value = '';
    }
  }
);

function handleSubmit() {
  const trimmed = description.value.trim();
  if (!trimmed) {
    error.value = 'Enter a description';
    return;
  }
  if (trimmed.length > 30) {
    error.value = 'Max 30 characters';
    return;
  }
  error.value = '';
  emit('submitDescription', trimmed);
}
</script>

<template>
  <div class="description-phase">
    <div class="round-badge">Round {{ store.room?.roundNumber }}</div>

    <div class="word-reveal">
      <template v-if="store.myWord">
        <p class="word-label">The Secret Word</p>
        <h1 class="word">{{ store.myWord }}</h1>
        <p class="role-badge civilian">You are a Civilian</p>
      </template>
      <template v-else>
        <p class="word-label">Your Role</p>
        <h1 class="word imposter-word">???</h1>
        <p class="role-badge imposter">You are the Imposter</p>
        <p class="imposter-hint">Listen to each clue as it appears and blend in.</p>
      </template>
    </div>

    <div class="turn-card">
      <p class="turn-label">Current Turn</p>
      <h2 class="turn-name">{{ currentDescriber?.name ?? 'Waiting...' }}</h2>
      <p class="turn-hint">
        {{
          isMyTurn
            ? 'Enter your clue now.'
            : currentDescriber
              ? `Waiting for ${currentDescriber.name} to enter a clue.`
              : 'Preparing the next clue.'
        }}
      </p>
      <button
        v-if="store.isHost && store.room?.currentDescriberId"
        class="btn btn-secondary btn-skip-turn"
        @click="$emit('skipDescriptionTurn')"
      >
        Skip Turn
      </button>
    </div>

    <div v-if="isMyTurn" class="description-input">
      <label class="input-label">
        {{ store.myWord ? 'Describe the word (be subtle!)' : 'Write a convincing description' }}
      </label>
      <div class="input-row">
        <input
          v-model="description"
          type="text"
          :placeholder="store.myWord ? 'Your clue...' : 'Blend in...'"
          maxlength="30"
          class="input"
          @keyup.enter="handleSubmit"
        />
        <button id="btn-submit-description" class="btn btn-primary" @click="handleSubmit">
          Submit
        </button>
      </div>
      <p class="char-count" :class="{ warn: description.length > 25 }">
        {{ description.length }}/30
      </p>
      <p v-if="error" class="error">{{ error }}</p>
    </div>

    <div v-else-if="store.hasSubmittedDescription" class="submitted-notice">
      <p class="check">
        {{
          wasSkipped
            ? 'Your turn was skipped by the host.'
            : 'Clue submitted. Waiting for the next player.'
        }}
      </p>
    </div>

    <div class="clue-board">
      <h3>Clues in Order</h3>
      <div class="clue-list">
        <div
          v-for="player in orderedPlayers"
          :key="player.id"
          class="clue-row"
          :class="{ active: player.id === store.room?.currentDescriberId }"
        >
          <span class="clue-name">{{ player.name }}</span>
          <span class="clue-text">
            {{
              store.room?.descriptions?.[player.id] === ''
                ? 'Skipped by host'
                : (store.room?.descriptions?.[player.id] ?? '...')
            }}
          </span>
        </div>
      </div>
    </div>

    <div class="progress">
      <h3>Clue Progress</h3>
      <div class="progress-bar">
        <div
          class="progress-fill"
          :style="{
            width: `${((store.room?.submittedDescriptionIds.length ?? 0) / (store.connectedPlayers.length || 1)) * 100}%`,
          }"
        ></div>
      </div>
      <p class="progress-text">
        {{ store.room?.submittedDescriptionIds.length ?? 0 }} /
        {{ store.connectedPlayers.length }} submitted
      </p>
    </div>
  </div>
</template>

<style scoped>
.description-phase {
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

.word-reveal,
.turn-card,
.description-input,
.clue-board,
.progress,
.submitted-notice {
  width: 100%;
  max-width: 360px;
}

.word-reveal,
.turn-card,
.clue-board,
.progress,
.submitted-notice {
  padding: 1.25rem;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
}

.word-reveal {
  text-align: center;
}

.word-label,
.turn-label {
  color: #64748b;
  font-size: 0.85rem;
  text-transform: uppercase;
  letter-spacing: 0.15em;
  margin-bottom: 0.5rem;
}

.word {
  font-size: 2.5rem;
  font-weight: 900;
  color: #22c55e;
  margin-bottom: 0.75rem;
}

.imposter-word {
  color: #ef4444;
}

.role-badge {
  display: inline-block;
  padding: 0.3rem 0.75rem;
  border-radius: 8px;
  font-size: 0.85rem;
  font-weight: 600;
}

.role-badge.civilian {
  background: rgba(34, 197, 94, 0.15);
  color: #22c55e;
  border: 1px solid rgba(34, 197, 94, 0.3);
}

.role-badge.imposter {
  background: rgba(239, 68, 68, 0.15);
  color: #ef4444;
  border: 1px solid rgba(239, 68, 68, 0.3);
}

.imposter-hint,
.turn-hint,
.progress-text {
  color: #94a3b8;
  font-size: 0.85rem;
}

.turn-name {
  color: #f8fafc;
  font-size: 1.4rem;
  margin-bottom: 0.35rem;
}

.btn-skip-turn {
  margin-top: 0.85rem;
}

.input-label {
  color: #94a3b8;
  font-size: 0.9rem;
  display: block;
  margin-bottom: 0.5rem;
}

.input-row {
  display: flex;
  gap: 0.5rem;
}

.input {
  flex: 1;
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
  border-color: #f97316;
}

.char-count {
  color: #64748b;
  font-size: 0.75rem;
  text-align: right;
  margin-top: 0.25rem;
}

.char-count.warn {
  color: #f97316;
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
}

.btn-secondary {
  background: rgba(255, 255, 255, 0.08);
  color: #e2e8f0;
  border: 2px solid rgba(255, 255, 255, 0.15);
}

.btn-primary:hover {
  transform: translateY(-2px);
}

.btn-secondary:hover {
  border-color: #f97316;
}

.error {
  color: #ef4444;
  font-size: 0.8rem;
  margin-top: 0.25rem;
}

.submitted-notice {
  text-align: center;
}

.check {
  color: #22c55e;
  font-weight: 600;
}

.clue-board h3,
.progress h3 {
  color: #e2e8f0;
  font-size: 1rem;
  margin-bottom: 0.75rem;
}

.clue-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.clue-row {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  padding: 0.75rem 0.85rem;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.clue-row.active {
  border-color: rgba(249, 115, 22, 0.35);
  background: rgba(249, 115, 22, 0.08);
}

.clue-name {
  color: #94a3b8;
  font-size: 0.8rem;
  font-weight: 600;
}

.clue-text {
  color: #f8fafc;
  font-size: 1rem;
  min-height: 1.2rem;
}

.progress-bar {
  height: 6px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
  overflow: hidden;
  margin-bottom: 0.5rem;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #f97316, #ef4444);
  border-radius: 3px;
  transition: width 0.5s ease;
}
</style>
