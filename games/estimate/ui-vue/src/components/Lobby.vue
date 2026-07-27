<script setup lang="ts">
import type { PlayerView } from '@shared/types';

defineProps<{
  players: PlayerView[];
  isHost: boolean;
  canStart: boolean;
  totalRounds: number;
}>();

defineEmits<{ start: [] }>();
</script>

<template>
  <div class="ui-panel" data-testid="estimate-lobby">
    <h2 class="ui-section-label">Lobby</h2>
    <ul class="ui-player-list">
      <li v-for="p in players" :key="p.id" class="ui-player-item">
        <span class="ui-avatar">{{ p.name.charAt(0).toUpperCase() }}</span>
        <span>{{ p.name }}</span>
        <span v-if="p.isHost" class="ui-badge">Host</span>
      </li>
    </ul>
    <p class="text-muted-foreground mt-2">
      {{ players.length }} Spieler · {{ totalRounds }} Runden geplant
    </p>
    <div v-if="isHost" class="mt-4">
      <button
        class="ui-btn-primary"
        type="button"
        :disabled="!canStart"
        data-testid="estimate-start"
        @click="$emit('start')"
      >
        Spiel starten
      </button>
    </div>
  </div>
</template>
