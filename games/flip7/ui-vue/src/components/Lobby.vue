<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { MIN_PLAYERS, DEFAULT_TARGET_SCORE } from '@shared/constants';
import { useGameStore } from '../stores/game';

const emit = defineEmits<{
  'start-game': [];
}>();

const { t } = useI18n();
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
        {{ t('flip7.lobby.tagline', { score: DEFAULT_TARGET_SCORE }) }}
      </p>
    </div>

    <!-- Players list -->
    <div class="ui-panel w-full max-w-md">
      <p class="ui-section-label mb-3">
        {{ t('flip7.lobby.players', { count: store.room?.players.length ?? 0 }) }}
      </p>
      <ul class="space-y-2">
        <li
          v-for="player in store.room?.players"
          :key="player.id"
          class="flex items-center gap-3 rounded-sm px-3 py-2"
          :class="player.id === store.playerId ? 'bg-flip7-muted' : 'bg-elevated'"
        >
          <span class="size-2 rounded-full" :class="player.connected ? 'bg-success' : 'bg-muted'" />
          <span class="flex-1 text-sm font-medium">{{ player.name }}</span>
          <span v-if="player.isHost" class="ui-badge text-xs text-flip7">{{
            t('flip7.lobby.host')
          }}</span>
          <span v-if="player.id === store.playerId" class="text-xs text-muted-foreground">{{
            t('flip7.lobby.you')
          }}</span>
        </li>
      </ul>
    </div>

    <!-- Fixed target score (visible to all) -->
    <div class="ui-panel w-full max-w-md">
      <p class="ui-section-label mb-2">{{ t('flip7.lobby.targetScore') }}</p>
      <p class="text-center text-2xl font-bold text-foreground">{{ DEFAULT_TARGET_SCORE }}</p>
      <p class="mt-1 text-center text-xs text-muted-foreground">
        {{ t('flip7.lobby.fixedRule') }}
      </p>
    </div>

    <!-- Start (host only) -->
    <template v-if="store.isHost">
      <button
        class="ui-btn-primary ui-btn-lg w-full max-w-md btn-flip7"
        type="button"
        :disabled="(store.room?.players.length ?? 0) < MIN_PLAYERS"
        @click="emit('start-game')"
      >
        {{ t('flip7.lobby.start') }}
      </button>
      <p
        v-if="(store.room?.players.length ?? 0) < MIN_PLAYERS"
        class="text-sm text-muted-foreground"
      >
        {{ t('flip7.lobby.needPlayers', { min: MIN_PLAYERS }) }}
      </p>
    </template>
    <p v-else class="text-sm text-muted-foreground">
      {{ t('flip7.lobby.waitingForHost') }}
    </p>
  </div>
</template>

<style scoped>
.btn-flip7 {
  background: var(--color-flip7);
  color: var(--color-canvas);
}

.btn-flip7:hover:not(:disabled) {
  background: var(--color-flip7-hover);
}
</style>
