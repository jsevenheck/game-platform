<script setup lang="ts">
defineProps<{
  playerName: string;
  error: string;
  submitting: boolean;
  selectedGameName?: string | null;
}>();

const emit = defineEmits<{
  'update:playerName': [string];
  submit: [];
  clearSelectedGame: [];
}>();

function onInput(event: Event): void {
  emit('update:playerName', (event.target as HTMLInputElement).value);
}
</script>

<template>
  <form class="home-form-panel flex flex-col gap-4" @submit.prevent="emit('submit')">
    <div class="flex flex-col gap-1.5">
      <label for="name" class="home-label">Your Name</label>
      <input
        id="name"
        class="ui-input"
        type="text"
        placeholder="Enter your name"
        maxlength="20"
        autocomplete="off"
        :value="playerName"
        data-testid="host-name-input"
        @input="onInput"
      />
    </div>

    <div v-if="selectedGameName" class="home-preselect" data-testid="host-preselect">
      <span class="home-preselect-label">Selected game</span>
      <span class="home-preselect-name">{{ selectedGameName }}</span>
      <button
        type="button"
        class="ui-btn-ghost home-preselect-clear"
        aria-label="Clear selected game"
        data-testid="host-preselect-clear"
        @click="emit('clearSelectedGame')"
      >
        ✕
      </button>
    </div>

    <Transition name="fade">
      <p v-if="error" class="home-error" role="alert" aria-live="polite">{{ error }}</p>
    </Transition>

    <button
      type="submit"
      class="ui-btn-primary home-submit"
      :disabled="submitting || !playerName.trim()"
    >
      {{ submitting ? 'Creating…' : 'Create Party' }}
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

.home-preselect {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: var(--color-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}

.home-preselect-label {
  font-size: 0.62rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--color-muted-foreground);
  font-family: 'JetBrains Mono', monospace;
}

.home-preselect-name {
  flex: 1;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-foreground);
}

.home-preselect-clear {
  padding: 0.15rem 0.5rem;
  font-size: 0.8rem;
  line-height: 1;
}
</style>
