<script setup lang="ts">
import { MAX_SIGNAL_NUMBER, TEAM_HEX_BY_COLOR } from '@shared/constants';
import type { TeamColor } from '@shared/types';
import { ref } from 'vue';

defineProps<{
  disabled: boolean;
  teamColor: TeamColor | null;
}>();

const emit = defineEmits<{
  'give-signal': [word: string, number: number];
}>();

const word = ref('');
const number = ref(1);
const error = ref('');

function submit() {
  const trimmed = word.value.trim();
  if (!trimmed) {
    error.value = 'Enter a clue word';
    return;
  }
  if (trimmed.includes(' ')) {
    error.value = 'Clue must be a single word';
    return;
  }
  if (number.value < 0 || number.value > MAX_SIGNAL_NUMBER) {
    error.value = `Number must be 0-${MAX_SIGNAL_NUMBER}`;
    return;
  }
  error.value = '';
  emit('give-signal', trimmed, number.value);
  word.value = '';
  number.value = 1;
}
</script>

<template>
  <div class="signal-input">
    <div class="signal-form">
      <input
        v-model="word"
        type="text"
        placeholder="Clue word"
        class="input input-word"
        :disabled="disabled"
        @keyup.enter="submit"
      />
      <div class="number-control">
        <button class="num-btn" :disabled="disabled || number <= 0" @click="number--">-</button>
        <span class="num-display">{{ number }}</span>
        <button
          class="num-btn"
          :disabled="disabled || number >= MAX_SIGNAL_NUMBER"
          @click="number++"
        >
          +
        </button>
      </div>
      <button
        class="btn btn-signal"
        :style="{
          backgroundColor: teamColor ? (TEAM_HEX_BY_COLOR[teamColor] ?? '#8b5cf6') : '#8b5cf6',
        }"
        :disabled="disabled"
        @click="submit"
      >
        Send Signal
      </button>
    </div>
    <p v-if="error" class="error">{{ error }}</p>
    <p class="hint">0 = unlimited guesses</p>
  </div>
</template>

<style scoped>
.signal-input {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.signal-form {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  justify-content: center;
}

.input {
  padding: 0.6rem 0.75rem;
  border: 2px solid #3f3f46;
  border-radius: 8px;
  background: #18181b;
  color: #fff;
  font-size: 0.95rem;
  outline: none;
  transition: border-color 0.2s;
}

.input:focus {
  border-color: #8b5cf6;
}

.input-word {
  width: 160px;
  text-transform: uppercase;
}

.number-control {
  display: flex;
  align-items: center;
  gap: 0;
  background: #18181b;
  border: 2px solid #3f3f46;
  border-radius: 8px;
  overflow: hidden;
}

.num-btn {
  width: 32px;
  height: 36px;
  background: transparent;
  border: none;
  color: #d4d4d8;
  font-size: 1.1rem;
  font-weight: 700;
  cursor: pointer;
}

.num-btn:hover:not(:disabled) {
  background: #3f3f46;
}

.num-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.num-display {
  width: 28px;
  text-align: center;
  color: #fff;
  font-weight: 700;
  font-size: 1rem;
}

.btn-signal {
  padding: 0.6rem 1.25rem;
  border: none;
  border-radius: 8px;
  color: #fff;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.2s;
}

.btn-signal:hover:not(:disabled) {
  opacity: 0.85;
}

.btn-signal:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.error {
  color: #ef4444;
  font-size: 0.8rem;
}

.hint {
  color: #71717a;
  font-size: 0.75rem;
}
</style>
