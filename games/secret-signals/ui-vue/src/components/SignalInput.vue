<script setup lang="ts">
import { MAX_SIGNAL_NUMBER } from '@shared/constants';
import type { TeamColor } from '@shared/types';
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
const props = defineProps<{ disabled: boolean; teamColor: TeamColor | null }>();
const emit = defineEmits<{ 'give-signal': [word: string, number: number] }>();
const { t } = useI18n();
const word = ref('');
const number = ref(1);
const error = ref('');
function submit() {
  if (props.disabled) return;
  const trimmed = word.value.trim();
  if (!trimmed) {
    error.value = t('secret-signals.signal.errorEmpty');
    return;
  }
  if (/\s/u.test(trimmed)) {
    error.value = t('secret-signals.signal.errorSingle');
    return;
  }
  if (!Number.isInteger(number.value) || number.value < 0 || number.value > MAX_SIGNAL_NUMBER) {
    error.value = t('secret-signals.signal.errorNumber', { max: MAX_SIGNAL_NUMBER });
    return;
  }
  error.value = '';
  // Keep the draft when the server rejects it; a successful turn unmounts this form.
  emit('give-signal', trimmed, number.value);
}
</script>

<template>
  <form class="signal-form" @submit.prevent="submit">
    <div class="word-field">
      <label for="signals-clue-word">{{ t('secret-signals.signal.clueWord') }}</label>
      <input
        id="signals-clue-word"
        v-model="word"
        type="text"
        :placeholder="t('secret-signals.signal.clueWord')"
        class="ui-input"
        :disabled="disabled"
        :aria-invalid="!!error"
        :aria-describedby="error ? 'signals-clue-error' : undefined"
        autocomplete="off"
        autocapitalize="characters"
        spellcheck="false"
        maxlength="100"
      />
    </div>
    <div class="number-field">
      <span id="signals-number-label">{{ t('secret-signals.signal.number') }}</span>
      <div class="number-stepper" role="group" aria-labelledby="signals-number-label">
        <button
          type="button"
          :aria-label="t('secret-signals.signal.decrease')"
          :disabled="disabled || number <= 0"
          @click="number--"
        >
          −
        </button>
        <output aria-live="polite">{{ number }}</output>
        <button
          type="button"
          :aria-label="t('secret-signals.signal.increase')"
          :disabled="disabled || number >= MAX_SIGNAL_NUMBER"
          @click="number++"
        >
          +
        </button>
      </div>
    </div>
    <button type="submit" class="ui-btn-primary send-signal" :disabled="disabled">
      {{ t('secret-signals.signal.send') }}
    </button>
    <p v-if="error" id="signals-clue-error" role="alert" class="signal-error">{{ error }}</p>
    <p class="number-help">{{ t('secret-signals.signal.unlimited') }}</p>
  </form>
</template>

<style scoped>
.signal-form {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: end;
  gap: 0.5rem 0.65rem;
  width: 100%;
}
.word-field,
.number-field {
  display: grid;
  gap: 0.35rem;
  min-width: 0;
}
label,
.number-field > span {
  color: #d5e3e5;
  font-size: 0.75rem;
  font-weight: 600;
}
.word-field input {
  min-width: 0;
  width: 100%;
  min-height: 46px;
  text-transform: uppercase;
  background: #f2e8d5;
  color: #07171c;
  border: 1px solid #f2e8d5;
  border-radius: 0.35rem;
}
.word-field input::placeholder {
  color: #52636a;
  text-transform: none;
}
.number-stepper {
  display: flex;
  align-items: center;
  border: 1px solid #658891;
  border-radius: 0.35rem;
  overflow: hidden;
}
.number-stepper button {
  width: 44px;
  height: 44px;
  color: #f4f7f6;
  font-size: 1.2rem;
}
.number-stepper button:disabled {
  opacity: 0.4;
}
.number-stepper button:hover:not(:disabled) {
  background: #28505b;
}
.number-stepper output {
  min-width: 1.6rem;
  text-align: center;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}
.send-signal {
  grid-column: 1 / -1;
  min-height: 44px;
  background: #f2e8d5;
  color: #07171c;
  border-color: #f2e8d5;
  white-space: normal;
}
.send-signal:hover:not(:disabled) {
  background: #fff6e6;
}
.signal-error,
.number-help {
  grid-column: 1 / -1;
  font-size: 0.75rem;
}
.signal-error {
  color: #ffc2b8;
}
.number-help {
  color: #c5d9dc;
}
button:focus-visible,
input:focus-visible {
  outline: 2px solid #fff;
  outline-offset: 2px;
}
@media (min-width: 600px) {
  .signal-form {
    grid-template-columns: minmax(0, 1fr) auto auto;
  }
  .send-signal {
    grid-column: auto;
  }
}
</style>
