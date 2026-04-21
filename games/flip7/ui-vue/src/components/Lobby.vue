<script setup lang="ts">
import { MIN_PLAYERS, DEFAULT_TARGET_SCORE } from '@shared/constants';
import { useGameStore } from '../stores/game';

const emit = defineEmits<{
  'start-game': [];
}>();

const store = useGameStore();
</script>

<template>
  <div class="flex min-h-dvh flex-col items-center justify-center gap-8 p-6">
    <!-- Header -->
    <div class="text-center">
      <div class="mb-2 inline-flex items-center gap-2">
        <span class="text-3xl">🃏</span>
        <h1 class="text-3xl font-bold text-flip7">Flip 7</h1>
      </div>
      <p class="text-sm text-muted-foreground">
        Push your luck — first to {{ DEFAULT_TARGET_SCORE }} points wins
      </p>
    </div>

    <!-- Players list -->
    <div class="ui-panel w-full max-w-md">
      <p class="ui-section-label mb-3">Players ({{ store.room?.players.length ?? 0 }})</p>
      <ul class="space-y-2">
        <li
          v-for="player in store.room?.players"
          :key="player.id"
          class="flex items-center gap-3 rounded-[--radius-sm] px-3 py-2"
          :class="player.id === store.playerId ? 'bg-flip7-muted' : 'bg-elevated'"
        >
          <span class="size-2 rounded-full" :class="player.connected ? 'bg-success' : 'bg-muted'" />
          <span class="flex-1 text-sm font-medium">{{ player.name }}</span>
          <span v-if="player.isHost" class="ui-badge text-xs text-flip7">Host</span>
          <span v-if="player.id === store.playerId" class="text-xs text-muted-foreground">You</span>
        </li>
      </ul>
    </div>

    <!-- Fixed target score (visible to all) -->
    <div class="ui-panel w-full max-w-md">
      <p class="ui-section-label mb-2">Target Score</p>
      <p class="text-center text-2xl font-bold text-foreground">{{ DEFAULT_TARGET_SCORE }}</p>
      <p class="mt-1 text-center text-xs text-muted-foreground">Fixed per official rules</p>
    </div>

    <!-- Start (host only) -->
    <template v-if="store.isHost">
      <button
        class="ui-btn-primary w-full max-w-md bg-flip7! hover:bg-flip7-hover!"
        type="button"
        :disabled="(store.room?.players.length ?? 0) < MIN_PLAYERS"
        @click="emit('start-game')"
      >
        Start Game
      </button>
      <p
        v-if="(store.room?.players.length ?? 0) < MIN_PLAYERS"
        class="text-sm text-muted-foreground"
      >
        Need at least {{ MIN_PLAYERS }} players to start
      </p>
    </template>
    <p v-else class="text-sm text-muted-foreground">Waiting for host to start…</p>
  </div>
</template>
