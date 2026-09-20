<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { localizeError } from '../../i18n/serverError';

const { t } = useI18n();

defineProps<{
  playerName: string;
  inviteCode: string;
  error: string;
  submitting: boolean;
}>();

const emit = defineEmits<{
  'update:playerName': [string];
  'update:inviteCode': [string];
  submit: [];
}>();

function onNameInput(event: Event): void {
  emit('update:playerName', (event.target as HTMLInputElement).value);
}

function onCodeInput(event: Event): void {
  emit('update:inviteCode', (event.target as HTMLInputElement).value);
}
</script>

<template>
  <form class="home-form-panel flex flex-col gap-4" @submit.prevent="emit('submit')">
    <div class="flex flex-col gap-1.5">
      <label for="name" class="home-label">{{ t('home.host.name') }}</label>
      <input
        id="name"
        class="ui-input"
        type="text"
        :placeholder="t('home.host.namePlaceholder')"
        maxlength="20"
        autocomplete="off"
        :value="playerName"
        data-testid="join-name-input"
        @input="onNameInput"
      />
    </div>

    <div class="flex flex-col gap-1.5">
      <label for="code" class="home-label">{{ t('home.join.inviteCode') }}</label>
      <input
        id="code"
        class="ui-input home-code-input uppercase"
        type="text"
        placeholder="ABC123"
        maxlength="6"
        autocomplete="off"
        :value="inviteCode"
        data-testid="join-code-input"
        @input="onCodeInput"
      />
    </div>

    <Transition name="fade">
      <p v-if="error" class="home-error" role="alert" aria-live="polite">
        {{ localizeError(error) }}
      </p>
    </Transition>

    <button
      type="submit"
      class="ui-btn-primary home-submit"
      :disabled="submitting || !playerName.trim() || !inviteCode.trim()"
    >
      {{ submitting ? t('home.join.joining') : t('home.join.join') }}
    </button>
  </form>
</template>

<style scoped>
.home-form-panel {
  max-width: 400px;
  margin: 0 auto;
}

.home-label {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--color-muted);
  letter-spacing: 0.02em;
}

.home-code-input {
  text-align: center;
  letter-spacing: 0.2em;
  font-family: 'JetBrains Mono', monospace;
  font-size: 1.125rem;
}

.home-error {
  font-size: 0.875rem;
  color: var(--color-danger);
  background: var(--color-danger-muted);
  border: 1px solid rgba(239, 68, 68, 0.2);
  border-radius: var(--radius-md);
  padding: 0.5rem 0.75rem;
}

.home-submit {
  width: 100%;
  font-size: 1rem;
  margin-top: 0.25rem;
  padding: 0.875rem 1.5rem;
}
</style>
