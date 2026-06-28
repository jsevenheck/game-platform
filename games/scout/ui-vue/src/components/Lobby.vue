<script setup lang="ts">
import { computed } from 'vue';
import { MIN_PLAYERS } from '@shared/constants';
import { useGameStore } from '../stores/game';

const emit = defineEmits<{ startGame: [] }>();
const store = useGameStore();

const playerCount = computed(() => store.room?.players.length ?? 0);
const canStart = computed(() => store.isHost && playerCount.value >= MIN_PLAYERS);
</script>

<template>
  <main class="mx-auto flex min-h-dvh max-w-3xl flex-col justify-center gap-6 p-6">
    <section class="ui-panel text-center">
      <p class="text-sm font-semibold uppercase tracking-[0.3em] text-scout">Scout</p>
      <h1 class="mt-2 text-4xl font-black text-foreground">Ready your row</h1>
      <p class="mt-3 text-muted">
        Play contiguous card runs, scout from the table, and collect the richest tricks.
      </p>
    </section>

    <section class="ui-panel">
      <div class="mb-4 flex items-center justify-between">
        <h2 class="text-xl font-bold text-foreground">Players ({{ playerCount }})</h2>
        <span class="ui-badge border-scout/40 bg-scout-muted text-scout"
          >{{ MIN_PLAYERS }}–5 players</span
        >
      </div>
      <ul class="space-y-2">
        <li
          v-for="player in store.room?.players ?? []"
          :key="player.id"
          class="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3"
        >
          <span class="font-semibold text-foreground">
            {{ player.name }}<span v-if="player.id === store.playerId"> (you)</span>
          </span>
          <span class="text-sm text-muted">{{
            player.isHost ? 'Host' : player.connected ? 'Ready' : 'Offline'
          }}</span>
        </li>
      </ul>
    </section>

    <button
      v-if="store.isHost"
      class="ui-btn-primary btn-scout w-full"
      type="button"
      :disabled="!canStart"
      @click="emit('startGame')"
    >
      Start Game
    </button>
    <p v-else class="text-center text-muted">Waiting for host to start…</p>
  </main>
</template>

<style scoped>
.btn-scout {
  background: linear-gradient(135deg, var(--color-scout) 0%, #22d3ee 100%);
}
</style>
