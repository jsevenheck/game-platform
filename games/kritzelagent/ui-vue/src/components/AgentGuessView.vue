<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';

const props = defineProps<{ topicCategory: string; pending: boolean }>();
const { t } = useI18n();
const emit = defineEmits<{ guess: [value: string] }>();
const value = ref('');
const error = ref('');

function submit() {
  if (props.pending) return;
  const guess = value.value.trim();
  if (!guess) {
    error.value = t('kritzelagent.agentGuess.errorEmpty');
    return;
  }
  error.value = '';
  emit('guess', guess);
}
</script>

<template>
  <section
    class="ui-panel"
    data-testid="kritzelagent-agent-guess"
    aria-labelledby="agent-guess-title"
  >
    <p class="text-sm text-muted-foreground">{{ t('kritzelagent.agentGuess.done') }}</p>
    <h2 id="agent-guess-title" data-phase-focus tabindex="-1">
      {{ t('kritzelagent.agentGuess.title') }}
    </h2>
    <p class="mt-2">
      {{ t('kritzelagent.agentGuess.intro', { category: topicCategory }) }}
    </p>
    <form class="mt-4" @submit.prevent="submit">
      <label class="ui-section-label" for="kritzelagent-guess">
        {{ t('kritzelagent.agentGuess.label') }}
      </label>
      <input
        id="kritzelagent-guess"
        v-model="value"
        class="ui-input"
        autocomplete="off"
        :disabled="pending"
        aria-describedby="kritzelagent-guess-error"
      />
      <p v-if="error" id="kritzelagent-guess-error" class="mt-1 text-sm text-danger" role="alert">
        {{ error }}
      </p>
      <button class="ui-btn-primary mt-3" type="submit" :disabled="pending">
        {{ pending ? t('kritzelagent.agentGuess.checking') : t('kritzelagent.agentGuess.submit') }}
      </button>
    </form>
  </section>
</template>
