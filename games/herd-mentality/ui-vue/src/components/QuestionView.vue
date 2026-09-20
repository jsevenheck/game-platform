<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { MAX_ANSWER_LENGTH } from '@shared/constants';
const props = defineProps<{
  prompt: string;
  round: number;
  totalRounds: number;
  pending: boolean;
}>();
const { t } = useI18n();
const emit = defineEmits<{ submit: [answer: string] }>();
const answer = ref('');
const validationError = ref('');
function submit() {
  if (props.pending) return;
  const value = answer.value.normalize('NFKC').trim().replace(/\s+/gu, ' ');
  validationError.value =
    value.length === 0
      ? t('herd-mentality.question.errorEmpty')
      : value.length > MAX_ANSWER_LENGTH
        ? t('herd-mentality.question.errorLength', { max: MAX_ANSWER_LENGTH })
        : '';
  if (!validationError.value) emit('submit', value);
}
</script>
<template>
  <section
    class="ui-panel"
    data-testid="herd-mentality-question"
    aria-labelledby="herd-mentality-question-title"
  >
    <p class="text-sm text-muted-foreground">
      {{ t('herd-mentality.question.progress', { round, total: totalRounds }) }}
    </p>
    <h2
      id="herd-mentality-question-title"
      class="mt-2 text-2xl font-semibold"
      data-phase-focus
      tabindex="-1"
    >
      {{ prompt }}
    </h2>
    <form class="mt-5" novalidate @submit.prevent="submit">
      <label class="ui-section-label" for="herd-mentality-answer">
        {{ t('herd-mentality.question.answerLabel') }}
      </label>
      <input
        id="herd-mentality-answer"
        v-model="answer"
        class="ui-input"
        type="text"
        maxlength="80"
        autocomplete="off"
        :disabled="pending"
        :aria-invalid="validationError ? 'true' : 'false'"
        aria-describedby="herd-mentality-answer-help herd-mentality-answer-error"
        :placeholder="t('herd-mentality.question.placeholder')"
        data-testid="herd-mentality-answer-input"
      />
      <p id="herd-mentality-answer-help" class="mt-1 text-sm text-muted-foreground">
        {{ t('herd-mentality.question.help') }}
      </p>
      <p
        v-if="validationError"
        id="herd-mentality-answer-error"
        class="mt-1 text-sm text-danger"
        role="alert"
      >
        {{ validationError }}
      </p>
      <button
        class="ui-btn-primary mt-4"
        type="submit"
        :disabled="pending"
        data-testid="herd-mentality-answer-submit"
      >
        {{ pending ? t('herd-mentality.question.saving') : t('herd-mentality.question.submit') }}
      </button>
    </form>
  </section>
</template>

<style scoped>
[data-testid='herd-mentality-question'] {
  width: 100%;
  min-width: 0;
  max-width: 100%;
  box-sizing: border-box;
}
[data-testid='herd-mentality-question'] h2 {
  max-width: 100%;
  white-space: normal;
  overflow-wrap: anywhere;
  word-break: break-word;
}
</style>
