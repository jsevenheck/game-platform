<script setup lang="ts">
import NumberLine from './NumberLine.vue';
import type { RoomView } from '@shared/types';

defineProps<{
  room: RoomView;
  isHost: boolean;
  myId: string;
}>();

const emit = defineEmits<{ reveal: []; next: [] }>();
</script>

<template>
  <div class="ui-panel" data-testid="estimate-reveal">
    <div class="flex items-center justify-between text-sm text-muted-foreground">
      <span>Runde {{ room.currentRound }} / {{ room.totalRounds }}</span>
    </div>
    <h2 class="mt-2 text-xl font-semibold">{{ room.question?.text }}</h2>

    <NumberLine :room="room" :my-id="myId" class="mt-4" />

    <div v-if="room.solution !== null" class="mt-4" data-testid="estimate-revealed-banner">
      <p class="text-lg">
        Lösung: <span class="font-bold">{{ room.solution }}</span>
      </p>
      <p v-if="room.winners.length > 0" class="text-success mt-1">
        🏆 Gewinner: {{ room.winners.map((w) => w.name).join(', ') }}
      </p>
    </div>

    <div v-if="isHost" class="mt-4 flex flex-wrap gap-2">
      <button
        v-if="room.solution === null"
        class="ui-btn-primary"
        type="button"
        data-testid="estimate-reveal-button"
        @click="emit('reveal')"
      >
        Auflösen
      </button>
      <button
        v-else
        class="ui-btn-primary"
        type="button"
        data-testid="estimate-next-button"
        @click="emit('next')"
      >
        Nächste Frage
      </button>
    </div>
  </div>
</template>
