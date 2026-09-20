<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useGameStore } from '../stores/game';
import Card from './Card.vue';

const emit = defineEmits<{ choose: [flip: boolean] }>();
const { t } = useI18n();
const store = useGameStore();
const waitingCount = computed(
  () => store.room?.players.filter((p) => !p.setupConfirmed).length ?? 0
);
</script>

<template>
  <main class="mx-auto flex min-h-dvh max-w-5xl flex-col justify-center gap-6 p-6">
    <section class="ui-panel text-center">
      <p class="text-sm font-semibold uppercase tracking-[0.3em] text-scout">
        {{ t('scout.setup.label') }}
      </p>
      <h1 class="mt-2 text-3xl font-black">{{ t('scout.setup.title') }}</h1>
      <p class="mt-3 text-muted">
        {{ t('scout.setup.intro') }}
      </p>
    </section>

    <section class="ui-panel">
      <div class="mb-4 flex items-center justify-between">
        <h2 class="font-bold text-foreground">{{ t('scout.setup.yourRow') }}</h2>
        <span class="text-sm text-muted">{{
          t('scout.setup.count', { count: store.myRow.length })
        }}</span>
      </div>
      <div data-testid="scout-setup-row" class="flex gap-2 overflow-x-auto py-3">
        <Card v-for="card in store.myRow" :key="card.id" :card="card" compact />
      </div>
    </section>

    <section v-if="!store.self?.setupConfirmed" class="grid gap-3 sm:grid-cols-2">
      <button class="ui-btn-secondary" type="button" @click="emit('choose', false)">
        {{ t('scout.setup.keep') }}
      </button>
      <button class="ui-btn-primary btn-scout" type="button" @click="emit('choose', true)">
        {{ t('scout.setup.flip') }}
      </button>
    </section>
    <p v-else class="text-center text-muted">
      {{ t('scout.setup.locked', { count: waitingCount }, waitingCount) }}
    </p>
  </main>
</template>

<style scoped>
.btn-scout {
  background: linear-gradient(135deg, var(--color-scout) 0%, #22d3ee 100%);
}
</style>
