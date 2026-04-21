<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount } from 'vue';
import { useGameStore } from '../stores/game';

const emit = defineEmits<{ 'play-again': [] }>();

const store = useGameStore();

// Delay action controls so players can absorb the final scoreboard first.
// Matches the GAME_OVER_OVERVIEW_MS delay in App.vue that holds off the
// platform overlay (PlatformAdapter replay/lobby buttons).
const CONTROLS_DELAY_MS = 4000;
const showControls = ref(false);
let controlsTimer: ReturnType<typeof setTimeout> | null = null;

onMounted(() => {
  controlsTimer = setTimeout(() => {
    showControls.value = true;
    controlsTimer = null;
  }, CONTROLS_DELAY_MS);
});

onBeforeUnmount(() => {
  if (controlsTimer) {
    clearTimeout(controlsTimer);
    controlsTimer = null;
  }
});

const winners = computed(
  () =>
    store.room?.winnerIds
      .map((id) => store.room!.players.find((p) => p.id === id))
      .filter(Boolean) ?? []
);

const sortedPlayers = computed(() =>
  [...(store.room?.players ?? [])].sort((a, b) => b.totalScore - a.totalScore)
);
</script>

<template>
  <div class="flex min-h-dvh flex-col items-center justify-center gap-8 p-6">
    <!-- Winner announcement -->
    <div class="text-center">
      <div class="text-5xl">🏆</div>
      <h1 class="mt-3 text-3xl font-bold text-flip7">
        {{ winners.length === 1 ? winners[0]?.name + ' Wins!' : 'Game Over!' }}
      </h1>
      <p class="mt-2 text-sm text-muted-foreground">
        {{
          winners.length === 1 ? `Reached ${store.room?.targetScore} points!` : 'Multiple winners'
        }}
      </p>
    </div>

    <!-- Final scoreboard -->
    <div class="ui-panel w-full max-w-md">
      <p class="ui-section-label mb-3">Final Scores</p>
      <ol class="space-y-2">
        <li
          v-for="(player, i) in sortedPlayers"
          :key="player.id"
          class="flex items-center gap-3 rounded-[--radius-sm] px-3 py-2"
          :class="{
            'bg-flip7-muted ring-1 ring-flip7': store.room?.winnerIds.includes(player.id),
            'bg-elevated': !store.room?.winnerIds.includes(player.id),
          }"
        >
          <span class="w-5 text-center text-sm font-bold text-muted-foreground">
            {{ i + 1 === 1 ? '🥇' : i + 1 === 2 ? '🥈' : i + 1 === 3 ? '🥉' : i + 1 }}
          </span>
          <span class="flex-1 text-sm font-medium text-foreground">{{ player.name }}</span>
          <span class="text-lg font-bold text-foreground">{{ player.totalScore }}</span>
        </li>
      </ol>
    </div>

    <!-- Play again (host only) — the PlatformAdapter shows its own overlay, but
         we also show a local button for reconnect scenarios or direct usage -->
    <template v-if="showControls">
      <button v-if="store.isHost" class="ui-btn-ghost" type="button" @click="emit('play-again')">
        Play Again
      </button>
      <p v-else class="text-sm text-muted-foreground">Waiting for host…</p>
    </template>
    <p v-else class="animate-pulse text-sm text-muted-foreground">Reviewing scores…</p>
  </div>
</template>
