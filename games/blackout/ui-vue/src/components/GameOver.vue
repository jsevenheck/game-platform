<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { useGameStore } from '../stores/game';
import { computed } from 'vue';

const { t } = useI18n();
const store = useGameStore();

defineEmits<{
  restart: [];
}>();

const sortedPlayers = computed(() => {
  if (!store.room) return [];
  return [...store.room.players].sort((a, b) => b.score - a.score);
});

const topScore = computed(() => sortedPlayers.value[0]?.score ?? 0);

const winners = computed(() => {
  return sortedPlayers.value.filter((p) => p.score === topScore.value);
});
</script>

<template>
  <div class="game-over flex flex-col items-center gap-8 px-4 py-8">
    <h1 class="text-4xl font-black text-foreground">{{ t('blackout.gameOver.title') }}</h1>

    <div class="text-center">
      <template v-if="winners.length === 1">
        <p class="ui-section-label">{{ t('blackout.gameOver.winner') }}</p>
        <h2 class="text-3xl font-bold text-blackout">{{ winners[0]?.name }}</h2>
      </template>
      <template v-else>
        <p class="ui-section-label">{{ t('blackout.gameOver.tie') }}</p>
        <h2 class="text-3xl font-bold text-blackout">
          {{ winners.map((w) => w.name).join(' & ') }}
        </h2>
      </template>
      <p class="mt-1 text-xl text-foreground">
        {{ t('blackout.gameOver.points', { count: topScore }) }}
      </p>
    </div>

    <div class="w-full max-w-xs">
      <h3 class="mb-3 text-center text-muted">{{ t('blackout.gameOver.finalScores') }}</h3>
      <div
        v-for="(player, index) in sortedPlayers"
        :key="player.id"
        class="mb-2 flex items-center gap-3 rounded-sm bg-elevated px-3 py-2.5"
        :class="player.score === topScore && 'border-2 border-blackout bg-blackout-muted'"
      >
        <span class="min-w-8 font-semibold text-muted-foreground">#{{ index + 1 }}</span>
        <span class="flex-1 text-foreground">{{ player.name }}</span>
        <span class="text-xl font-bold text-blackout">{{ player.score }}</span>
      </div>
    </div>

    <button
      v-if="store.isHost"
      class="ui-btn-primary btn-blackout btn-blackout-hover"
      @click="$emit('restart')"
    >
      {{ t('blackout.gameOver.playAgain') }}
    </button>
    <p v-else class="text-muted-foreground">{{ t('blackout.gameOver.waiting') }}</p>
  </div>
</template>

<style scoped>
.btn-blackout {
  background: var(--color-blackout);
}
.btn-blackout-hover:hover:not(:disabled) {
  background: var(--color-blackout-hover);
}
.border-blackout-active {
  border-color: var(--color-blackout);
}
.focus-border-blackout-active:focus {
  border-color: var(--color-blackout);
}
</style>
