<script setup lang="ts">
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useGameStore } from '../stores/game';
import { MIN_PLAYERS } from '@shared/constants';
import type { Language } from '@shared/types';

const { t } = useI18n();
const store = useGameStore();
const excludedLettersInput = ref('');

const emit = defineEmits<{
  updateMaxRounds: [delta: -1 | 1];
  updateRoomSettings: [settings: { language: Language; excludedLetters: string[] }];
  startGame: [];
}>();

function adjustRounds(delta: -1 | 1) {
  emit('updateMaxRounds', delta);
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
      <h3 class="mb-3 text-muted">
        {{ t('blackout.lobby.players', { count: connectedCount() }) }}
      </h3>
      <div
        v-for="player in store.room?.players"
        :key="player.id"
        class="mb-2 flex items-center gap-2 rounded-sm bg-elevated px-3 py-2"
        :class="{ 'opacity-50': !player.connected }"
      >
        <span class="flex-1 text-foreground">{{ player.name }}</span>
        <span v-if="store.room?.ownerId === player.id" class="ui-badge bg-signals text-white">{{
          t('blackout.lobby.owner')
        }}</span>
        <span v-if="player.isHost" class="ui-badge bg-blackout text-white">{{
          t('blackout.lobby.host')
        }}</span>
        <span v-if="!player.connected" class="ui-badge bg-elevated text-muted-foreground">{{
          t('blackout.lobby.offline')
        }}</span>
      </div>
    </div>

    <div v-if="store.isHost" class="flex flex-col items-center gap-4">
      <div class="rounds-config flex items-center gap-3 text-foreground">
        <span>{{ t('blackout.lobby.rounds') }}</span>
        <button
          class="ui-stepper-btn hover:border-blackout-active"
          type="button"
          :aria-label="t('blackout.lobby.fewerRounds')"
          @click="adjustRounds(-1)"
        >
          −
        </button>
        <span class="rounds-value min-w-8 text-center text-2xl font-bold" aria-live="polite">{{
          store.room?.maxRounds
        }}</span>
        <button
          class="ui-stepper-btn hover:border-blackout-active"
          type="button"
          :aria-label="t('blackout.lobby.moreRounds')"
          @click="adjustRounds(1)"
        >
          +
        </button>
      </div>

      <div class="flex items-center gap-2 text-foreground">
        <span>{{ t('blackout.lobby.language') }}</span>
        <button
          class="ui-stepper-btn text-sm hover:border-blackout-active"
          :class="store.room?.language === 'de' && 'border-blackout-active text-foreground'"
          @click="updateLanguage('de')"
        >
          DE
        </button>
        <button
          class="ui-stepper-btn text-sm hover:border-blackout-active"
          :class="store.room?.language === 'en' && 'border-blackout-active text-foreground'"
          @click="updateLanguage('en')"
        >
          EN
        </button>
      </div>

      <div class="flex w-full max-w-xs flex-col gap-1">
        <label for="excluded-letters" class="text-sm text-muted">{{
          t('blackout.lobby.excludedLetters')
        }}</label>
        <div class="flex gap-2">
          <input
            id="excluded-letters"
            v-model="excludedLettersInput"
            class="ui-input flex-1 focus:border-blackout-active"
            type="text"
            placeholder="Q, X, Y"
            @keydown.enter.prevent="saveExcludedLetters"
            @blur="saveExcludedLetters"
          />
          <button
            class="ui-stepper-btn w-auto min-w-14 px-3 text-sm hover:border-blackout-active"
            @click="saveExcludedLetters"
          >
            {{ t('blackout.lobby.save') }}
          </button>
        </div>
      </div>

      <button
        class="ui-btn-primary ui-btn-lg btn-blackout btn-blackout-hover"
        :disabled="connectedCount() < MIN_PLAYERS"
        @click="$emit('startGame')"
      >
        {{ t('blackout.lobby.start') }}
      </button>
      <p v-if="connectedCount() < MIN_PLAYERS" class="text-sm text-muted-foreground">
        {{ t('blackout.lobby.needPlayers', { min: MIN_PLAYERS }) }}
      </p>
    </div>

    <div v-else class="text-muted-foreground">
      <p>{{ t('blackout.lobby.waitingForHost') }}</p>
    </div>
  </div>
</template>

<style scoped>
.btn-blackout {
  background: var(--color-blackout);
}
.btn-blackout-hover:hover:not(:disabled) {
  background: var(--color-blackout-hover);
}
.border-blackout-active {
  border-color: var(--color-blackout);
}
.focus-border-blackout-active:focus {
  border-color: var(--color-blackout);
}
</style>
