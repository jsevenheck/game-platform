<script setup lang="ts">
import { ref } from 'vue';

const props = defineProps<{ topicCategory: string; pending: boolean }>();
const emit = defineEmits<{ guess: [value: string] }>();
const value = ref('');
const error = ref('');

function submit() {
  if (props.pending) return;
  const guess = value.value.trim();
  if (!guess) {
    error.value = 'Bitte nenne ein Motiv.';
    return;
  }
  error.value = '';
  emit('guess', guess);
}
</script>

<template>
  <section class="ui-panel" aria-labelledby="agent-guess-title">
    <p class="text-sm text-muted-foreground">Die Abstimmung ist entschieden.</p>
    <h2 id="agent-guess-title" data-phase-focus tabindex="-1">
      Letzte Chance für den Kritzelagenten
    </h2>
    <p class="mt-2">
      Du kennst die Kategorie <strong>{{ topicCategory }}</strong
      >. Wie lautet das Motiv?
    </p>
    <form class="mt-4" @submit.prevent="submit">
      <label class="ui-section-label" for="kritzelagent-guess">Dein Motiv-Tipp</label>
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
        {{ pending ? 'Wird geprüft…' : 'Motiv raten' }}
      </button>
    </form>
  </section>
</template>
