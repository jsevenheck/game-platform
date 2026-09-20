<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import type { RoomView } from '@shared/types';

const props = defineProps<{ room: RoomView; myId: string; pending: boolean }>();
const { t } = useI18n();
const emit = defineEmits<{ vote: [targetPlayerId: string] }>();
const selectedId = ref('');

function submit() {
  if (!selectedId.value || props.pending) return;
  emit('vote', selectedId.value);
}
</script>

<template>
  <section class="ui-panel" data-testid="kritzelagent-voting" aria-labelledby="voting-title">
    <p class="text-sm text-muted-foreground">{{ t('kritzelagent.voting.done') }}</p>
    <h2 id="voting-title" data-phase-focus tabindex="-1">
      {{ t('kritzelagent.voting.title') }}
    </h2>
    <p class="mt-2 text-sm text-muted-foreground">
      {{ t('kritzelagent.voting.hint') }}
    </p>
    <form class="kritzelagent-voting" @submit.prevent="submit">
      <fieldset
        :disabled="pending || room.votes.find((vote) => vote.playerId === myId)?.hasVoted === true"
      >
        <legend class="sr-only">{{ t('kritzelagent.voting.legend') }}</legend>
        <div class="kritzelagent-voting__grid">
          <label
            v-for="player in room.players.filter(
              (candidate) => candidate.connected && candidate.id !== myId
            )"
            :key="player.id"
            class="kritzelagent-vote-option"
            :class="{ 'kritzelagent-vote-option--selected': selectedId === player.id }"
          >
            <input
              v-model="selectedId"
              type="radio"
              name="kritzelagent-suspect"
              :value="player.id"
            />
            <span>{{ player.name }}</span>
          </label>
        </div>
      </fieldset>
      <button
        class="ui-btn-primary"
        type="submit"
        :disabled="
          pending ||
          !selectedId ||
          room.votes.find((vote) => vote.playerId === myId)?.hasVoted === true
        "
      >
        {{ pending ? t('kritzelagent.voting.sending') : t('kritzelagent.voting.submit') }}
      </button>
    </form>
    <p class="mt-3 text-sm text-muted-foreground" aria-live="polite">
      {{
        t('kritzelagent.voting.progress', {
          voted: room.votes.filter((vote) => vote.hasVoted).length,
          total: room.players.filter((player) => player.connected).length,
        })
      }}
    </p>
  </section>
</template>

<style scoped>
.kritzelagent-voting {
  display: grid;
  gap: 1rem;
  margin-top: 1rem;
}
.kritzelagent-voting__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
  gap: 0.75rem;
}
.kritzelagent-vote-option {
  display: flex;
  min-height: 3rem;
  align-items: center;
  gap: 0.65rem;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-md, 0.5rem);
  padding: 0.75rem;
  cursor: pointer;
}
.kritzelagent-vote-option:focus-within,
.kritzelagent-vote-option--selected {
  border-color: var(--color-kritzelagent);
  background: var(--color-kritzelagent-muted);
}
.kritzelagent-vote-option input {
  accent-color: var(--color-kritzelagent);
}
</style>
