<script setup lang="ts">
import { computed } from 'vue';
import type { PlayerView } from '@shared/types';

const props = defineProps<{
  players: PlayerView[];
  isHost: boolean;
  canStart: boolean;
  pending: boolean;
  totalRounds: number;
}>();

const emit = defineEmits<{ start: [] }>();
const connectedCount = computed(() => props.players.filter((player) => player.connected).length);
</script>

<template>
  <section class="ui-panel" data-testid="estimate-lobby" aria-labelledby="estimate-lobby-title">
    <h2 id="estimate-lobby-title" class="text-xl font-semibold" data-phase-focus tabindex="-1">
      Lobby
    </h2>
    <ul class="ui-player-list mt-3" aria-label="Mitspieler">
      <li v-for="player in players" :key="player.id" class="ui-player-item">
        <span class="ui-avatar" aria-hidden="true">{{ player.name.charAt(0).toUpperCase() }}</span>
        <span>{{ player.name }}</span>
        <span v-if="player.isHost" class="ui-badge">Host</span>
        <span
          v-if="!player.connected"
          class="ui-badge disconnected-badge"
          :aria-label="`${player.name} ist nicht verbunden`"
        >
          Getrennt
        </span>
      </li>
    </ul>
    <p class="text-muted-foreground mt-2" aria-live="polite">
      {{ connectedCount }} von {{ players.length }} verbunden · {{ totalRounds }} Runden geplant
    </p>
    <div v-if="isHost" class="mt-4">
      <button
        class="ui-btn-primary"
        type="button"
        :disabled="!canStart || pending"
        data-testid="estimate-start"
        @click="emit('start')"
      >
        {{ pending ? 'Spiel wird gestartet…' : 'Spiel starten' }}
      </button>
      <p v-if="!canStart" class="text-muted-foreground mt-2 text-sm">
        Zum Starten müssen mindestens zwei Spieler verbunden sein.
      </p>
    </div>
    <p v-else class="text-muted-foreground mt-4" role="status">
      Warte darauf, dass der Host startet.
    </p>
  </section>
</template>

<style scoped>
.disconnected-badge {
  color: var(--color-muted-foreground);
  border-color: currentColor;
}
</style>
