<script setup lang="ts">
import { ref } from 'vue';

defineProps<{
  question: string;
  round: number;
  totalRounds: number;
}>();

const emit = defineEmits<{ submit: [guess: number] }>();

const input = ref('');
const validationError = ref('');

function parseAndSubmit() {
  validationError.value = '';
  const trimmed = input.value.trim().replace(',', '.');
  if (trimmed === '') {
    validationError.value = 'Bitte eine Zahl eingeben.';
    return;
  }
  const num = Number(trimmed);
  if (!Number.isFinite(num) || Math.abs(num) > 1e9) {
    validationError.value = 'Ungültige Zahl.';
    return;
  }
  emit('submit', num);
}
</script>

<template>
  <div class="ui-panel" data-testid="estimate-question">
    <div class="flex items-center justify-between text-sm text-muted-foreground">
      <span>Runde {{ round }} / {{ totalRounds }}</span>
    </div>
    <h2 class="mt-2 text-xl font-semibold">{{ question }}</h2>
    <form class="mt-4" @submit.prevent="parseAndSubmit">
      <label class="ui-section-label" for="guess">Deine Schätzung</label>
      <input
        id="guess"
        v-model="input"
        class="ui-input"
        type="number"
        step="any"
        inputmode="decimal"
        autocomplete="off"
        data-testid="estimate-guess-input"
        placeholder="z. B. 1989"
      />
      <p v-if="validationError" class="text-sm text-danger mt-1">{{ validationError }}</p>
      <button class="ui-btn-primary mt-3" type="submit" data-testid="estimate-guess-submit">
        Schätzung abgeben
      </button>
    </form>
  </div>
</template>
