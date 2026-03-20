<script setup lang="ts">
import { ref, watch } from 'vue';
import { useGameStore } from '../stores/game';
import { MIN_ROUNDS, MAX_ROUNDS, MIN_PLAYERS } from '@shared/constants';
import type { Language } from '@shared/types';

const store = useGameStore();
const excludedLettersInput = ref('');

const emit = defineEmits<{
  updateMaxRounds: [rounds: number];
  updateRoomSettings: [settings: { language: Language; excludedLetters: string[] }];
  startGame: [];
}>();

function adjustRounds(delta: number) {
  const current = store.room?.maxRounds ?? 10;
  const next = Math.min(MAX_ROUNDS, Math.max(MIN_ROUNDS, current + delta));
  emit('updateMaxRounds', next);
}

const connectedCount = () => store.room?.players.filter((p) => p.connected).length ?? 0;

watch(
  () => store.room?.excludedLetters,
  (letters) => {
    excludedLettersInput.value = (letters ?? []).join(', ');
  },
  { immediate: true }
);

function parseExcludedLetters(input: string): string[] {
  const unique = new Set(
    input
      .split(/[,\s]+/)
      .map((letter) => letter.trim().toUpperCase())
      .filter((letter) => /^[A-Z]$/.test(letter))
  );
  return Array.from(unique);
}

function updateLanguage(language: Language) {
  const excludedLetters = parseExcludedLetters(excludedLettersInput.value);
  emit('updateRoomSettings', { language, excludedLetters });
}

function saveExcludedLetters() {
  const language = store.room?.language ?? 'de';
  const excludedLetters = parseExcludedLetters(excludedLettersInput.value);
  emit('updateRoomSettings', { language, excludedLetters });
}
</script>

<template>
  <div class="lobby">
    <div class="room-code-display">
      <p class="label">
        Room Code
      </p>
      <h2 class="code">
        {{ store.roomCode }}
      </h2>
      <p class="hint">
        Share this code with your friends!
      </p>
    </div>

    <div class="players-list">
      <h3>Players ({{ connectedCount() }})</h3>
      <div
        v-for="player in store.room?.players"
        :key="player.id"
        class="player-item"
        :class="{ disconnected: !player.connected }"
      >
        <span class="player-name">{{ player.name }}</span>
        <span
          v-if="store.room?.ownerId === player.id"
          class="badge owner"
        >Owner</span>
        <span
          v-if="player.isHost"
          class="badge host"
        >Host</span>
        <span
          v-if="!player.connected"
          class="badge offline"
        >Offline</span>
      </div>
    </div>

    <div
      v-if="store.isHost"
      class="config"
    >
      <div class="rounds-config">
        <span>Rounds:</span>
        <button
          class="btn-sm"
          @click="adjustRounds(-1)"
        >
          -
        </button>
        <span class="rounds-value">{{ store.room?.maxRounds }}</span>
        <button
          class="btn-sm"
          @click="adjustRounds(1)"
        >
          +
        </button>
      </div>

      <div class="language-config">
        <span>Language:</span>
        <button
          class="btn-sm lang-btn"
          :class="{ active: store.room?.language === 'de' }"
          @click="updateLanguage('de')"
        >
          DE
        </button>
        <button
          class="btn-sm lang-btn"
          :class="{ active: store.room?.language === 'en' }"
          @click="updateLanguage('en')"
        >
          EN
        </button>
      </div>

      <div class="letters-config">
        <label for="excluded-letters">Excluded letters</label>
        <div class="letters-row">
          <input
            id="excluded-letters"
            v-model="excludedLettersInput"
            class="letters-input"
            type="text"
            placeholder="Q, X, Y"
            @keydown.enter.prevent="saveExcludedLetters"
            @blur="saveExcludedLetters"
          >
          <button
            class="btn-sm letters-save"
            @click="saveExcludedLetters"
          >
            Save
          </button>
        </div>
      </div>

      <button
        class="btn btn-primary btn-start"
        :disabled="connectedCount() < MIN_PLAYERS"
        @click="$emit('startGame')"
      >
        Start Game
      </button>
      <p
        v-if="connectedCount() < MIN_PLAYERS"
        class="hint"
      >
        Need at least {{ MIN_PLAYERS }} players to start
      </p>
    </div>

    <div
      v-else
      class="waiting"
    >
      <p>Waiting for host to start the game...</p>
    </div>
  </div>
</template>

<style scoped>
.lobby {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2rem;
  padding: 2rem 1rem;
}

.room-code-display {
  text-align: center;
}

.label {
  color: #71717a;
  text-transform: uppercase;
  font-size: 0.75rem;
  letter-spacing: 0.1em;
}

.code {
  font-size: 3rem;
  font-weight: 900;
  letter-spacing: 0.4em;
  color: #8b5cf6;
}

.hint {
  color: #71717a;
  font-size: 0.875rem;
}

.players-list {
  width: 100%;
  max-width: 320px;
}

.players-list h3 {
  color: #a1a1aa;
  margin-bottom: 0.75rem;
}

.player-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: #27272a;
  border-radius: 6px;
  margin-bottom: 0.5rem;
}

.player-item.disconnected {
  opacity: 0.5;
}

.player-name {
  flex: 1;
  color: #fff;
}

.badge {
  font-size: 0.7rem;
  padding: 0.15rem 0.5rem;
  border-radius: 4px;
  text-transform: uppercase;
  font-weight: 600;
}

.badge.host {
  background: #8b5cf6;
  color: #fff;
}

.badge.owner {
  background: #0ea5e9;
  color: #fff;
}

.badge.offline {
  background: #3f3f46;
  color: #71717a;
}

.config {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.rounds-config {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  color: #d4d4d8;
}

.language-config {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #d4d4d8;
}

.lang-btn.active {
  border-color: #8b5cf6;
  color: #fff;
}

.letters-config {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  width: 100%;
  max-width: 320px;
  color: #d4d4d8;
}

.letters-config label {
  font-size: 0.85rem;
  color: #a1a1aa;
}

.letters-row {
  display: flex;
  gap: 0.5rem;
}

.letters-input {
  flex: 1;
  padding: 0.55rem 0.7rem;
  border: 1px solid #3f3f46;
  border-radius: 6px;
  background: #18181b;
  color: #fafafa;
}

.letters-input:focus {
  outline: none;
  border-color: #8b5cf6;
}

.rounds-value {
  font-size: 1.5rem;
  font-weight: 700;
  min-width: 2rem;
  text-align: center;
}

.btn-sm {
  width: 2rem;
  height: 2rem;
  border: 2px solid #3f3f46;
  border-radius: 6px;
  background: #18181b;
  color: #d4d4d8;
  font-size: 1.2rem;
  cursor: pointer;
}

.btn-sm:hover {
  border-color: #8b5cf6;
}

.btn-sm.letters-save {
  width: auto;
  min-width: 3.5rem;
  padding: 0 0.8rem;
  font-size: 0.85rem;
}

.btn {
  padding: 0.75rem 2rem;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
}

.btn-primary {
  background: #8b5cf6;
  color: #fff;
}

.btn-primary:hover:not(:disabled) {
  background: #7c3aed;
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-start {
  padding: 1rem 3rem;
  font-size: 1.25rem;
}

.waiting {
  color: #71717a;
}
</style>
