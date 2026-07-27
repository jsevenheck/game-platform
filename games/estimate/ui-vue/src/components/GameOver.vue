<script setup lang="ts">
import type { ScoreEntry, WinnerEntry } from '@shared/types';

defineProps<{
  scores: ScoreEntry[];
  winners: WinnerEntry[];
  isHost: boolean;
  myScore: number;
}>();

const emit = defineEmits<{ restart: [] }>();
</script>

<template>
  <div class="ui-panel" data-testid="estimate-gameover">
    <h2 class="ui-section-label">Spielende</h2>
    <p class="mt-2 text-xl font-semibold">Deine Punkte: {{ myScore }}</p>
    <ul class="mt-4 ui-player-list">
      <li
        v-for="s in [...scores].sort((a, b) => b.points - a.points)"
        :key="s.playerId"
        class="ui-player-item"
      >
        <span class="ui-avatar">{{ s.name.charAt(0).toUpperCase() }}</span>
        <span>{{ s.name }}</span>
        <span class="ml-auto font-semibold">{{ s.points }}</span>
      </li>
    </ul>
    <div v-if="isHost" class="mt-4">
      <button
        class="ui-btn-primary"
        type="button"
        data-testid="estimate-restart"
        @click="emit('restart')"
      >
        Nochmal spielen
      </button>
    </div>
  </div>
</template>
