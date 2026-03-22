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
  <div class="flex flex-col items-center gap-2">
    <div class="flex items-center gap-2 flex-wrap justify-center">
      <input
        v-model="word"
        type="text"
        placeholder="Clue word"
        class="ui-input !w-40 !bg-white/5 !border-white/10 focus:!border-signals uppercase"
        :disabled="disabled"
        @keyup.enter="submit"
      />
      <div class="flex items-center bg-panel border-2 border-border-strong rounded-[--radius-sm] overflow-hidden">
        <button
          class="w-8 h-9 bg-transparent border-none text-foreground/80 text-lg font-bold cursor-pointer hover:bg-border-strong disabled:opacity-30 disabled:cursor-not-allowed"
          :disabled="disabled || number <= 0"
          @click="number--"
        >-</button>
        <span class="w-7 text-center text-foreground font-bold">{{ number }}</span>
        <button
          class="w-8 h-9 bg-transparent border-none text-foreground/80 text-lg font-bold cursor-pointer hover:bg-border-strong disabled:opacity-30 disabled:cursor-not-allowed"
          :disabled="disabled || number >= MAX_SIGNAL_NUMBER"
          @click="number++"
        >+</button>
      </div>
      <button
        class="ui-btn-primary !rounded-[--radius-sm]"
        :style="{
          backgroundColor: teamColor ? (TEAM_HEX_BY_COLOR[teamColor] ?? 'var(--color-signals)') : 'var(--color-signals)',
        }"
        :disabled="disabled"
        @click="submit"
      >
        Send Signal
      </button>
    </div>
    <p v-if="error" class="text-danger text-xs">{{ error }}</p>
    <p class="text-muted-foreground text-xs">0 = unlimited guesses</p>
  </div>
</template>
