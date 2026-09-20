<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { MIN_PLAYERS } from '@shared/constants';
import { useGameStore } from '../stores/game';

const emit = defineEmits<{ startGame: [] }>();
const { t } = useI18n();
const store = useGameStore();

const playerCount = computed(() => store.room?.players.length ?? 0);
const canStart = computed(() => store.isHost && playerCount.value >= MIN_PLAYERS);
</script>

<template>
  <main class="mx-auto flex min-h-dvh max-w-3xl flex-col justify-center gap-6 p-6">
    <section class="ui-panel text-center">
      <p class="text-sm font-semibold uppercase tracking-[0.3em] text-scout">Scout</p>
      <h1 class="mt-2 text-4xl font-black text-foreground">{{ t('scout.lobby.title') }}</h1>
      <p class="mt-3 text-muted">
        {{ t('scout.lobby.intro') }}
      </p>
    </section>

    <section class="ui-panel">
      <div class="mb-4 flex items-center justify-between">
        <h2 class="text-xl font-bold text-foreground">
          {{ t('scout.lobby.players', { count: playerCount }) }}
        </h2>
        <span class="ui-badge border-scout/40 bg-scout-muted text-scout">{{
          t('scout.lobby.range', { min: MIN_PLAYERS, max: 5 })
        }}</span>
      </div>
      <ul class="space-y-2">
        <li
          v-for="player in store.room?.players ?? []"
          :key="player.id"
          class="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3"
        >
          <span class="font-semibold text-foreground">
            {{ player.name
            }}<span v-if="player.id === store.playerId" class="ml-1">{{ t('scout.you') }}</span>
          </span>
          <span class="text-sm text-muted">{{
            player.isHost
              ? t('scout.lobby.host')
              : player.connected
                ? t('scout.lobby.ready')
                : t('scout.lobby.offline')
          }}</span>
        </li>
      </ul>
    </section>

    <button
      v-if="store.isHost"
      class="ui-btn-primary ui-btn-lg btn-scout w-full"
      type="button"
      :disabled="!canStart"
      @click="emit('startGame')"
    >
      {{ t('scout.lobby.start') }}
    </button>
    <p v-else class="text-center text-muted">{{ t('scout.lobby.waitingForHost') }}</p>
  </main>
</template>

<style scoped>
.btn-scout {
  background: linear-gradient(135deg, var(--color-scout) 0%, #22d3ee 100%);
}
</style>
