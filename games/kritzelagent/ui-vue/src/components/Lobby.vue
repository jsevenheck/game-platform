<script setup lang="ts">
import { computed } from 'vue';
import type { PlayerView } from '@shared/types';

const props = defineProps<{
  players: PlayerView[];
  isHost: boolean;
  canStart: boolean;
  pending: boolean;
}>();

const playerCount = computed(() => props.players.filter((player) => player.connected).length);

defineEmits<{ start: [] }>();
</script>

<template>
  <section class="ui-panel kritzelagent-lobby" aria-labelledby="lobby-title">
    <p class="text-sm text-muted-foreground">5–12 Spieler · Zeichnen und Deduktion</p>
    <h2 id="lobby-title" data-phase-focus tabindex="-1">Bereit für die nächste Skizze?</h2>
    <p class="mt-2">Alle zeichnen gemeinsam. Eine Person kennt nur die Kategorie.</p>
    <h3 class="mt-5 text-lg font-semibold">Spieler ({{ playerCount }}/12)</h3>
    <ul class="kritzelagent-player-list" aria-label="Spieler im Raum">
      <li v-for="player in players" :key="player.id">
        <span>{{ player.name }}<span v-if="player.isHost"> (Host)</span></span>
        <span :class="player.connected ? 'text-success' : 'text-muted-foreground'">{{
          player.connected ? 'bereit' : 'offline'
        }}</span>
      </li>
    </ul>
    <button
      v-if="isHost"
      class="ui-btn-primary mt-5"
      type="button"
      :disabled="!canStart || pending"
      @click="$emit('start')"
    >
      {{
        pending ? 'Wird gestartet…' : canStart ? 'Spiel starten' : 'Warte auf mindestens 5 Spieler'
      }}
    </button>
    <p v-else class="mt-4 text-sm text-muted-foreground" role="status">
      Warte, bis der Host das Spiel startet.
    </p>
  </section>
</template>

<style scoped>
.kritzelagent-lobby {
  display: grid;
  gap: 0.35rem;
}
.kritzelagent-lobby h2 {
  margin-top: 0.25rem;
  font-size: 1.35rem;
  font-weight: 700;
}
.kritzelagent-player-list {
  display: grid;
  gap: 0.35rem;
  margin-top: 0.75rem;
  padding: 0;
  list-style: none;
}
.kritzelagent-player-list li {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  border-bottom: 1px solid var(--color-border);
  padding: 0.45rem 0;
}
</style>
