<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';

const props = defineProps<{
  question: string;
  round: number;
  totalRounds: number;
  pending: boolean;
}>();

const { t } = useI18n();
const emit = defineEmits<{ submit: [guess: number] }>();
const input = ref('');
const validationError = ref('');

function parseAndSubmit() {
  if (props.pending) return;
  validationError.value = '';
  const trimmed = String(input.value).trim().replace(',', '.');
  if (trimmed === '') {
    validationError.value = t('estimate.question.errorEmpty');
    return;
  }
  const num = Number(trimmed);
  if (!Number.isFinite(num) || Math.abs(num) > 1e9) {
    validationError.value = t('estimate.question.errorRange');
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
    <p class="text-sm text-muted-foreground">
      {{ t('estimate.question.round', { round, total: totalRounds }) }}
    </p>
    <h2
      id="estimate-question-title"
      class="mt-2 text-xl font-semibold"
      data-phase-focus
      tabindex="-1"
    >
      {{ question }}
    </h2>
    <form class="mt-4" novalidate @submit.prevent="parseAndSubmit">
      <label class="ui-section-label" for="estimate-guess">
        {{ t('estimate.question.yourGuess') }}
      </label>
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
        :placeholder="t('estimate.question.placeholder')"
      />
      <p id="estimate-guess-help" class="text-sm text-muted-foreground mt-1">
        {{ t('estimate.question.help') }}
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
        {{ pending ? t('estimate.question.submitting') : t('estimate.question.submit') }}
      </button>
    </form>
  </section>
</template>
