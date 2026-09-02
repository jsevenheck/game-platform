<script setup lang="ts">
import { computed } from 'vue';
import type { RoomView } from '@shared/types';
const props = defineProps<{ room: RoomView; isHost: boolean; pending: boolean }>();
const emit = defineEmits<{ reveal: []; next: [] }>();
const isLast = computed(() => props.room.currentRound >= props.room.totalRounds);
const groupText = (group: { playerNames: string[]; count: number }) =>
  `${group.playerNames.join(', ')} (${group.count})`;
</script>
<template>
  <section
    class="ui-panel"
    data-testid="herd-mentality-reveal"
    aria-labelledby="herd-mentality-reveal-title"
  >
    <p class="text-sm text-muted-foreground">
      Frage {{ room.currentRound }} von {{ room.totalRounds }}
    </p>
    <h2
      id="herd-mentality-reveal-title"
      class="mt-2 text-xl font-semibold"
      data-phase-focus
      tabindex="-1"
    >
      {{ room.prompt?.text }}
    </h2>
    <div v-if="room.result" class="mt-5" data-testid="herd-mentality-groups" aria-live="polite">
      <h3 class="font-semibold">Die Antworten der Herde</h3>
      <ul class="mt-3 space-y-2" aria-label="Antwortgruppen">
        <li v-for="group in room.result.groups" :key="group.answer" class="ui-panel">
          <strong>{{ group.answer }}</strong> · {{ groupText(group) }}
          <span v-if="group.count >= 2" class="ml-2 text-success">+1 Kuh pro Person</span>
        </li>
      </ul>
      <p v-if="room.result.pinkCowPlayerId" class="mt-3 text-warning">
        Eine einzelne Antwort bekommt die Pink Cow.
      </p>
      <p v-if="room.winners.length" class="mt-3 text-success">
        Gewonnen: {{ room.winners.map((winner) => winner.name).join(', ') }}
      </p>
    </div>
    <p v-else class="mt-5 text-muted-foreground" role="status">
      Alle Antworten sind da. Der Host kann jetzt auflösen.
    </p>
    <div v-if="isHost && room.phase === 'allSubmitted'" class="mt-5">
      <button
        class="ui-btn-primary"
        type="button"
        data-testid="herd-mentality-reveal-button"
        :disabled="pending"
        @click="emit('reveal')"
      >
        {{ pending ? 'Wird aufgelöst…' : 'Antworten auflösen' }}
      </button>
    </div>
    <div v-else-if="isHost && room.phase === 'reveal'" class="mt-5">
      <button
        class="ui-btn-primary"
        type="button"
        data-testid="herd-mentality-next-button"
        :disabled="pending"
        @click="emit('next')"
      >
        {{ pending ? 'Wird geladen…' : isLast ? 'Endergebnis anzeigen' : 'Nächste Frage' }}
      </button>
    </div>
    <p v-else-if="room.phase === 'allSubmitted'" class="mt-5 text-muted-foreground" role="status">
      Warte darauf, dass der Host die Antworten auflöst.
    </p>
  </section>
</template>
