<script setup lang="ts">
import { ref } from 'vue';

const props = defineProps<{
  question: string;
  round: number;
  totalRounds: number;
  pending: boolean;
}>();

const emit = defineEmits<{ submit: [guess: number] }>();
const input = ref('');
const validationError = ref('');

function parseAndSubmit() {
  if (props.pending) return;
  validationError.value = '';
  const trimmed = String(input.value).trim().replace(',', '.');
  if (trimmed === '') {
    validationError.value = 'Bitte eine Zahl eingeben.';
    return;
  }
  const num = Number(trimmed);
  if (!Number.isFinite(num) || Math.abs(num) > 1e9) {
    validationError.value =
      'Bitte eine endliche Zahl zwischen −1.000.000.000 und 1.000.000.000 eingeben.';
    return;
  }
  emit('submit', num);
}
</script>

<template>
  <section
    class="ui-panel"
    data-testid="estimate-question"
    aria-labelledby="estimate-question-title"
  >
    <p class="text-sm text-muted-foreground">Runde {{ round }} von {{ totalRounds }}</p>
    <h2
      id="estimate-question-title"
      class="mt-2 text-xl font-semibold"
      data-phase-focus
      tabindex="-1"
    >
      {{ question }}
    </h2>
    <form class="mt-4" novalidate @submit.prevent="parseAndSubmit">
      <label class="ui-section-label" for="estimate-guess">Deine Schätzung</label>
      <input
        id="estimate-guess"
        v-model="input"
        class="ui-input"
        type="number"
        step="any"
        inputmode="decimal"
        autocomplete="off"
        :disabled="pending"
        :aria-invalid="validationError ? 'true' : 'false'"
        aria-describedby="estimate-guess-help estimate-guess-error"
        data-testid="estimate-guess-input"
        placeholder="z. B. 1989"
      />
      <p id="estimate-guess-help" class="text-sm text-muted-foreground mt-1">
        Ganze Zahlen, Dezimalzahlen und negative Werte sind erlaubt.
      </p>
      <p
        v-if="validationError"
        id="estimate-guess-error"
        class="text-sm text-danger mt-1"
        role="alert"
      >
        {{ validationError }}
      </p>
      <button
        class="ui-btn-primary mt-3"
        type="submit"
        :disabled="pending"
        data-testid="estimate-guess-submit"
      >
        {{ pending ? 'Wird gesendet…' : 'Schätzung abgeben' }}
      </button>
    </form>
  </section>
</template>
