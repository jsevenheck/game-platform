<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import type { RoomView } from '@shared/types';

const props = defineProps<{ room: RoomView; isHost: boolean; pending: boolean }>();
const { t } = useI18n();
defineEmits<{ next: [] }>();
const agentName = () =>
  props.room.players.find((player) => player.id === props.room.roundResult?.agentId)?.name ??
  t('kritzelagent.reveal.unknown');

function scoreDelta(playerId: string): number {
  return props.room.roundResult?.scoreDeltas[playerId] ?? 0;
}
</script>

<template>
  <section class="ui-panel" data-testid="kritzelagent-reveal" aria-labelledby="reveal-title">
    <p class="text-sm text-muted-foreground">
      {{ t('kritzelagent.reveal.resolved', { round: room.currentRound }) }}
    </p>
    <h2 id="reveal-title" data-phase-focus tabindex="-1">
      {{ t('kritzelagent.reveal.title') }}
    </h2>
    <div v-if="room.roundResult" class="kritzelagent-result" aria-live="polite">
      <p>
        {{ t('kritzelagent.reveal.wasAgent', { name: agentName() }) }}
      </p>
      <p>
        {{ t('kritzelagent.reveal.motif') }} <strong>{{ room.roundResult.topic }}</strong>
      </p>
      <p v-if="room.roundResult.agentCaught && room.roundResult.agentGuessed === false">
        {{ t('kritzelagent.reveal.caught') }}
      </p>
      <p v-else-if="room.roundResult.agentGuessed === true">
        {{ t('kritzelagent.reveal.guessed') }}
      </p>
      <p v-else>{{ t('kritzelagent.reveal.escaped') }}</p>
    </div>
    <h3 class="mt-5 text-lg font-semibold">{{ t('kritzelagent.reveal.votes') }}</h3>
    <ul class="kritzelagent-vote-results">
      <li v-for="entry in room.voteCounts" :key="entry.playerId">
        <span>{{ entry.name }}</span
        ><strong>{{ entry.votes }}</strong>
      </li>
    </ul>
    <h3 class="mt-5 text-lg font-semibold">{{ t('kritzelagent.reveal.roundPoints') }}</h3>
    <ul v-if="room.roundResult" class="kritzelagent-vote-results">
      <li v-for="player in room.players" :key="player.id">
        <span>{{ player.name }}</span
        ><strong>{{ scoreDelta(player.id) > 0 ? '+' : '' }}{{ scoreDelta(player.id) }}</strong>
      </li>
    </ul>
    <button
      v-if="isHost"
      class="ui-btn-primary mt-5"
      type="button"
      :disabled="pending"
      @click="$emit('next')"
    >
      {{
        room.currentRound >= room.totalRounds
          ? t('kritzelagent.reveal.showResult')
          : t('kritzelagent.reveal.next')
      }}
    </button>
    <p v-else class="mt-4 text-sm text-muted-foreground" role="status">
      {{ t('kritzelagent.reveal.waitingForHost') }}
    </p>
  </section>
</template>

<style scoped>
.kritzelagent-result {
  display: grid;
  gap: 0.35rem;
  margin-top: 1rem;
  border-radius: var(--radius-md, 0.5rem);
  background: var(--color-kritzelagent-muted);
  padding: 1rem;
}
.kritzelagent-vote-results {
  display: grid;
  gap: 0.35rem;
  margin-top: 0.75rem;
  padding: 0;
  list-style: none;
}
.kritzelagent-vote-results li {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  border-bottom: 1px solid var(--color-border);
  padding: 0.35rem 0;
}
</style>
