<script setup lang="ts">
import { computed } from 'vue';
import NumberLine from './NumberLine.vue';
import type { RoomView } from '@shared/types';

const props = defineProps<{
  room: RoomView;
  isHost: boolean;
  myId: string;
  pending: boolean;
}>();

const emit = defineEmits<{ reveal: []; next: [] }>();
const numberFormatter = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 6 });
const isLastRound = computed(() => props.room.currentRound >= props.room.totalRounds);
</script>

<template>
  <section class="ui-panel" data-testid="estimate-reveal" aria-labelledby="estimate-reveal-title">
    <p class="text-sm text-muted-foreground">
      Runde {{ room.currentRound }} von {{ room.totalRounds }}
    </p>
    <h2
      id="estimate-reveal-title"
      class="mt-2 text-xl font-semibold estimate-question-heading"
      data-phase-focus
      tabindex="-1"
    >
      {{ room.question?.text }}
    </h2>

    <NumberLine :room="room" :my-id="myId" class="mt-4" />

    <div
      v-if="room.solution !== null"
      class="mt-4"
      data-testid="estimate-revealed-banner"
      role="status"
      aria-live="polite"
    >
      <p class="text-lg">
        Lösung: <strong>{{ numberFormatter.format(room.solution) }}</strong>
      </p>
      <p v-if="room.winners.length > 0" class="text-success mt-1">
        Gewinner: {{ room.winners.map((winner) => winner.name).join(', ') }}
      </p>
    </div>

    <div v-if="isHost" class="mt-4 flex min-w-0 flex-wrap gap-2 estimate-reveal-actions">
      <button
        v-if="room.solution === null"
        class="ui-btn-primary"
        type="button"
        :disabled="pending"
        data-testid="estimate-reveal-button"
        @click="emit('reveal')"
      >
        {{ pending ? 'Wird aufgelöst…' : 'Auflösen' }}
      </button>
      <button
        v-else
        class="ui-btn-primary"
        type="button"
        :disabled="pending"
        data-testid="estimate-next-button"
        @click="emit('next')"
      >
        {{ pending ? 'Wird geladen…' : isLastRound ? 'Endergebnis anzeigen' : 'Nächste Frage' }}
      </button>
    </div>
    <p v-else-if="room.solution === null" class="text-muted-foreground mt-4" role="status">
      Warte darauf, dass der Host auflöst.
    </p>
  </section>
</template>

<style scoped>
.estimate-question-heading {
  overflow-wrap: anywhere;
}

.estimate-reveal-actions .ui-btn-primary {
  max-width: 100%;
  min-width: 0;
  white-space: normal;
}
</style>
