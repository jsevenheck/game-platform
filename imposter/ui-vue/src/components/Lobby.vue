<script setup lang="ts">
import { ref, computed } from 'vue';
import type { PlayerView } from '@shared/types';
import {
  MIN_DISCUSSION_DURATION_MS,
  MAX_DISCUSSION_DURATION_MS,
  DISCUSSION_DURATION_STEP_MS,
  MIN_TARGET_SCORE,
  MAX_TARGET_SCORE,
} from '@shared/constants';
import { useGameStore } from '../stores/game';

withDefaults(
  defineProps<{
    errorMessage?: string;
  }>(),
  {
    errorMessage: '',
  }
);

const store = useGameStore();

const emit = defineEmits<{
  startGame: [];
  configureLobby: [
    config: { infiltratorCount: number; discussionDurationMs: number; targetScore: number },
  ];
  submitWord: [word: string];
  kickPlayer: [playerId: string];
}>();

const isHost = computed(
  () => store.room?.players.find((p: PlayerView) => p.id === store.playerId)?.isHost ?? false
);

const connectedCount = computed(
  () => store.room?.players.filter((p: PlayerView) => p.connected).length ?? 0
);

const MIN_PLAYERS = 3;

const newWord = ref('');
const infiltratorCount = computed(() => store.room?.infiltratorCount ?? 1);
const discussionDurationMs = computed(
  () => store.room?.discussionDurationMs ?? MIN_DISCUSSION_DURATION_MS
);
const targetScore = computed(() => store.room?.targetScore ?? MIN_TARGET_SCORE);

function handleConfigChange(
  nextConfig?: Partial<{
    infiltratorCount: number;
    discussionDurationMs: number;
    targetScore: number;
  }>
) {
  emit('configureLobby', {
    infiltratorCount: nextConfig?.infiltratorCount ?? infiltratorCount.value,
    discussionDurationMs: nextConfig?.discussionDurationMs ?? discussionDurationMs.value,
    targetScore: nextConfig?.targetScore ?? targetScore.value,
  });
}

function handleSubmitWord() {
  const word = newWord.value.trim();
  if (!word) return;
  emit('submitWord', word);
  newWord.value = '';
}
</script>

<template>
  <div class="lobby">
    <div class="room-code-display">
      <p class="label">Room Code</p>
      <h2 class="code">
        {{ store.roomCode }}
      </h2>
      <p class="hint">Share this code with your friends!</p>
    </div>

    <div class="players-list">
      <h3>Players ({{ connectedCount }})</h3>
      <div
        v-for="player in store.room?.players"
        :key="player.id"
        class="player-item"
        :class="{ disconnected: !player.connected }"
      >
        <span class="player-name">{{ player.name }}</span>
        <button
          v-if="isHost && player.id !== store.playerId"
          class="badge kick"
          type="button"
          @click="$emit('kickPlayer', player.id)"
        >
          Kick
        </button>
        <span v-if="player.isHost" class="badge host">Host</span>
        <span v-if="!player.connected" class="badge offline">Offline</span>
      </div>
    </div>

    <!-- Host controls -->
    <div v-if="isHost" class="host-controls">
      <div class="config-section">
        <h3 class="config-title">⚙️ Game Settings</h3>

        <div class="config-row">
          <label class="config-label">
            Infiltrators
            <span class="config-hint">
              {{ infiltratorCount === 0 ? '(Paranoia Mode!)' : '' }}
            </span>
          </label>
          <div class="stepper">
            <button
              class="stepper-btn"
              :disabled="infiltratorCount <= 0"
              @click="handleConfigChange({ infiltratorCount: infiltratorCount - 1 })"
            >
              -
            </button>
            <span class="stepper-value">{{ infiltratorCount }}</span>
            <button
              class="stepper-btn"
              :disabled="infiltratorCount >= Math.max(connectedCount - 1, 1)"
              @click="handleConfigChange({ infiltratorCount: infiltratorCount + 1 })"
            >
              +
            </button>
          </div>
        </div>

        <div class="config-row">
          <label class="config-label">Discussion Timer</label>
          <div class="stepper">
            <button
              class="stepper-btn"
              :disabled="discussionDurationMs <= MIN_DISCUSSION_DURATION_MS"
              @click="
                handleConfigChange({
                  discussionDurationMs: discussionDurationMs - DISCUSSION_DURATION_STEP_MS,
                })
              "
            >
              -
            </button>
            <span class="stepper-value timer-value">{{ discussionDurationMs / 1000 }}s</span>
            <button
              class="stepper-btn"
              :disabled="discussionDurationMs >= MAX_DISCUSSION_DURATION_MS"
              @click="
                handleConfigChange({
                  discussionDurationMs: discussionDurationMs + DISCUSSION_DURATION_STEP_MS,
                })
              "
            >
              +
            </button>
          </div>
        </div>

        <div class="config-row">
          <label class="config-label">Target Score</label>
          <div class="stepper">
            <button
              class="stepper-btn"
              :disabled="targetScore <= MIN_TARGET_SCORE"
              @click="handleConfigChange({ targetScore: targetScore - 1 })"
            >
              -
            </button>
            <span class="stepper-value">{{ targetScore }}</span>
            <button
              class="stepper-btn"
              :disabled="targetScore >= MAX_TARGET_SCORE"
              @click="handleConfigChange({ targetScore: targetScore + 1 })"
            >
              +
            </button>
          </div>
        </div>
        <p v-if="errorMessage" class="config-error">{{ errorMessage }}</p>
        <p class="config-hint">First player to {{ targetScore }} points wins the match.</p>

        <div class="word-submit">
          <label class="config-label">Add a Custom Word</label>
          <div class="word-input-row">
            <input
              v-model="newWord"
              type="text"
              placeholder="Enter a word..."
              maxlength="40"
              class="input"
              @keyup.enter="handleSubmitWord"
            />
            <button class="btn btn-small" @click="handleSubmitWord">Add</button>
          </div>
          <p class="config-hint">{{ store.room?.wordLibraryCount ?? 0 }} words in library</p>
        </div>
      </div>

      <button
        id="btn-start-game"
        class="btn btn-primary btn-start"
        :disabled="connectedCount < MIN_PLAYERS"
        @click="$emit('startGame')"
      >
        🚀 Start Game
      </button>
      <p v-if="connectedCount < MIN_PLAYERS" class="hint">
        Need at least {{ MIN_PLAYERS }} players to start
      </p>
    </div>

    <!-- Non-host: also allow word submission -->
    <div v-else class="non-host-section">
      <div class="word-submit">
        <label class="config-label">Suggest a Word</label>
        <div class="word-input-row">
          <input
            v-model="newWord"
            type="text"
            placeholder="Enter a word..."
            maxlength="40"
            class="input"
            @keyup.enter="handleSubmitWord"
          />
          <button class="btn btn-small" @click="handleSubmitWord">Add</button>
        </div>
        <p class="config-hint">{{ store.room?.wordLibraryCount ?? 0 }} words in library</p>
      </div>
      <div class="waiting">
        <p>⏳ Waiting for host to start the game...</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.lobby {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
  padding: 2rem 1rem;
  min-height: 100dvh;
  background: linear-gradient(135deg, #0f0f23 0%, #1a1a2e 50%, #16213e 100%);
}

.room-code-display {
  text-align: center;
}

.label {
  color: #64748b;
  text-transform: uppercase;
  font-size: 0.75rem;
  letter-spacing: 0.15em;
}

.code {
  font-size: 3rem;
  font-weight: 900;
  letter-spacing: 0.4em;
  background: linear-gradient(135deg, #f97316, #ef4444);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.hint {
  color: #64748b;
  font-size: 0.85rem;
}

.players-list {
  width: 100%;
  max-width: 340px;
}

.players-list h3 {
  color: #94a3b8;
  margin-bottom: 0.75rem;
  font-size: 0.95rem;
}

.player-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.65rem 0.85rem;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  margin-bottom: 0.5rem;
  transition: all 0.2s;
}

.player-item.disconnected {
  opacity: 0.4;
}

.player-name {
  flex: 1;
  color: #e2e8f0;
  font-weight: 500;
}

.badge {
  font-size: 0.65rem;
  padding: 0.15rem 0.5rem;
  border-radius: 6px;
  text-transform: uppercase;
  font-weight: 700;
  letter-spacing: 0.05em;
}

.badge.host {
  background: linear-gradient(135deg, #f97316, #ef4444);
  color: #fff;
}

.badge.kick {
  border: none;
  background: rgba(239, 68, 68, 0.18);
  color: #fca5a5;
  cursor: pointer;
}

.badge.kick:hover {
  background: rgba(239, 68, 68, 0.28);
  color: #fee2e2;
}

.badge.offline {
  background: rgba(255, 255, 255, 0.1);
  color: #64748b;
}

.host-controls {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
  width: 100%;
  max-width: 340px;
}

.config-section {
  width: 100%;
  padding: 1.25rem;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 14px;
}

.config-title {
  color: #e2e8f0;
  font-size: 1rem;
  margin-bottom: 1rem;
}

.config-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
}

.config-label {
  color: #94a3b8;
  font-size: 0.9rem;
  font-weight: 500;
  display: block;
  margin-bottom: 0.5rem;
}

.config-hint {
  color: #64748b;
  font-size: 0.8rem;
  margin-top: 0.25rem;
}

.config-error {
  color: #ef4444;
  font-size: 0.8rem;
  margin-bottom: 0.75rem;
}

.stepper {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.stepper-btn {
  width: 36px;
  height: 36px;
  border: 2px solid rgba(255, 255, 255, 0.15);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.05);
  color: #e2e8f0;
  font-size: 1.2rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.stepper-btn:hover:not(:disabled) {
  border-color: #f97316;
  background: rgba(249, 115, 22, 0.1);
}

.stepper-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.stepper-value {
  color: #f97316;
  font-size: 1.5rem;
  font-weight: 800;
  min-width: 2rem;
  text-align: center;
}

.timer-value {
  min-width: 3.5rem;
}

.word-submit {
  margin-top: 0.5rem;
}

.word-input-row {
  display: flex;
  gap: 0.5rem;
}

.input {
  flex: 1;
  padding: 0.65rem 0.85rem;
  border: 2px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.05);
  color: #fff;
  font-size: 0.9rem;
  outline: none;
  transition: all 0.3s;
}

.input:focus {
  border-color: #f97316;
}

.btn {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 10px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s;
}

.btn-small {
  padding: 0.65rem 1rem;
  font-size: 0.85rem;
  background: linear-gradient(135deg, #f97316, #ef4444);
  color: #fff;
  border-radius: 10px;
}

.btn-small:hover {
  transform: translateY(-1px);
}

.btn-primary {
  background: linear-gradient(135deg, #f97316, #ef4444);
  color: #fff;
  box-shadow: 0 4px 15px rgba(249, 115, 22, 0.3);
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 25px rgba(249, 115, 22, 0.4);
}

.btn-primary:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.btn-start {
  padding: 1rem 3rem;
  font-size: 1.2rem;
  width: 100%;
}

.non-host-section {
  width: 100%;
  max-width: 340px;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.waiting {
  text-align: center;
  color: #64748b;
  font-style: italic;
}
</style>
