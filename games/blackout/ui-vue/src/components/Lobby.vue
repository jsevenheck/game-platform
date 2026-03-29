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
  <div class="lobby flex flex-col items-center gap-8 px-4 py-8">
    <div class="w-full max-w-xs">
      <h3 class="mb-3 text-muted">Players ({{ connectedCount() }})</h3>
      <div
        v-for="player in store.room?.players"
        :key="player.id"
        class="mb-2 flex items-center gap-2 rounded-[--radius-sm] bg-elevated px-3 py-2"
        :class="{ 'opacity-50': !player.connected }"
      >
        <span class="flex-1 text-foreground">{{ player.name }}</span>
        <span v-if="store.room?.ownerId === player.id" class="ui-badge bg-signals text-white"
          >Owner</span
        >
        <span v-if="player.isHost" class="ui-badge bg-blackout text-white">Host</span>
        <span v-if="!player.connected" class="ui-badge bg-elevated text-muted-foreground"
          >Offline</span
        >
      </div>
    </div>

    <div v-if="store.isHost" class="flex flex-col items-center gap-4">
      <div class="rounds-config flex items-center gap-3 text-foreground">
        <span>Rounds:</span>
        <button class="ui-stepper-btn hover:border-blackout!" @click="adjustRounds(-1)">-</button>
        <span class="rounds-value min-w-8 text-center text-2xl font-bold">{{
          store.room?.maxRounds
        }}</span>
        <button class="ui-stepper-btn hover:border-blackout!" @click="adjustRounds(1)">+</button>
      </div>

      <div class="flex items-center gap-2 text-foreground">
        <span>Language:</span>
        <button
          class="ui-stepper-btn text-sm hover:border-blackout!"
          :class="store.room?.language === 'de' && 'border-blackout! text-foreground'"
          @click="updateLanguage('de')"
        >
          DE
        </button>
        <button
          class="ui-stepper-btn text-sm hover:border-blackout!"
          :class="store.room?.language === 'en' && 'border-blackout! text-foreground'"
          @click="updateLanguage('en')"
        >
          EN
        </button>
      </div>

      <div class="flex w-full max-w-xs flex-col gap-1">
        <label for="excluded-letters" class="text-sm text-muted">Excluded letters</label>
        <div class="flex gap-2">
          <input
            id="excluded-letters"
            v-model="excludedLettersInput"
            class="ui-input flex-1 focus:border-blackout!"
            type="text"
            placeholder="Q, X, Y"
            @keydown.enter.prevent="saveExcludedLetters"
            @blur="saveExcludedLetters"
          />
          <button
            class="ui-stepper-btn w-auto min-w-14 px-3 text-sm hover:border-blackout!"
            @click="saveExcludedLetters"
          >
            Save
          </button>
        </div>
      </div>

      <button
        class="ui-btn-primary bg-blackout! px-12 py-4 text-xl hover:bg-blackout-hover!"
        :disabled="connectedCount() < MIN_PLAYERS"
        @click="$emit('startGame')"
      >
        Start Game
      </button>
      <p v-if="connectedCount() < MIN_PLAYERS" class="text-sm text-muted-foreground">
        Need at least {{ MIN_PLAYERS }} players to start
      </p>
    </div>

    <div v-else class="text-muted-foreground">
      <p>Waiting for host to start the game...</p>
    </div>
  </div>
</template>
