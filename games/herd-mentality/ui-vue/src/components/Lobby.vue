<script setup lang="ts">
import { computed } from 'vue';
import type { PlayerView } from '@shared/types';
import { MIN_PLAYERS } from '@shared/constants';

const props = defineProps<{
  players: PlayerView[];
  isHost: boolean;
  canStart: boolean;
  pending: boolean;
  totalRounds: number;
}>();
const emit = defineEmits<{ start: [] }>();
const connected = computed(() => props.players.filter((player) => player.connected).length);
</script>
<template>
  <section
    class="ui-panel"
    data-testid="herd-mentality-lobby"
    aria-labelledby="herd-mentality-lobby-title"
  >
    <p class="text-sm text-muted-foreground">Mehrheitsrunde · {{ totalRounds }} Fragen</p>
    <h2
      id="herd-mentality-lobby-title"
      class="mt-2 text-xl font-semibold"
      data-phase-focus
      tabindex="-1"
    >
      Die Herde sammelt sich
    </h2>
    <ul class="ui-player-list mt-4" aria-label="Mitspieler">
      <li v-for="player in players" :key="player.id" class="ui-player-item">
        <span class="ui-avatar" aria-hidden="true">{{ player.name.charAt(0).toUpperCase() }}</span>
        <span>{{ player.name }}</span
        ><span v-if="player.isHost" class="ui-badge">Host</span>
        <span v-if="!player.connected" class="ui-badge">Getrennt</span>
      </li>
    </ul>
    <p class="mt-3 text-muted-foreground" aria-live="polite">
      {{ connected }} von {{ players.length }} verbunden · mindestens {{ MIN_PLAYERS }} benötigt
    </p>
    <div v-if="isHost" class="mt-4">
      <button
        class="ui-btn-primary"
        type="button"
        data-testid="herd-mentality-start"
        :disabled="!canStart || pending"
        @click="emit('start')"
      >
        {{ pending ? 'Wird gestartet…' : 'Spiel starten' }}
      </button>
      <p v-if="!canStart" class="mt-2 text-sm text-muted-foreground">
        Zum Starten müssen mindestens vier Spieler verbunden sein.
      </p>
    </div>
    <p v-else class="mt-4 text-muted-foreground" role="status">
      Warte darauf, dass der Host startet.
    </p>
  </section>
</template>
