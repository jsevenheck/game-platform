<script setup lang="ts">
import { computed } from 'vue';
import type { PlayerView } from '@shared/types';
import { useGameStore } from '../stores/game';

const store = useGameStore();

defineEmits<{
  restart: [];
}>();

const isHost = computed(
  () => store.room?.players.find((p: PlayerView) => p.id === store.playerId)?.isHost ?? false
);

const sortedPlayers = computed(() => {
  if (!store.room) return [];
  return [...store.room.players].sort((a, b) => b.score - a.score);
});

const topScore = computed(() => sortedPlayers.value[0]?.score ?? 0);

const winners = computed(() =>
  sortedPlayers.value.filter((p: PlayerView) => p.score === topScore.value)
);

const singleWinner = computed(() =>
  winners.value.length === 1 ? (winners.value[0] ?? null) : null
);
</script>

<template>
  <div
    class="game-over flex flex-col items-center gap-6 px-4 py-8 min-h-dvh bg-linear-to-br from-imposter-gradient-1 via-imposter-gradient-2 to-imposter-gradient-3"
  >
    <h1
      class="text-4xl font-black bg-linear-to-br from-imposter via-danger to-pink-500 bg-clip-text text-transparent"
    >
      Game Over!
    </h1>

    <div class="text-center">
      <template v-if="singleWinner">
        <p class="text-muted-foreground uppercase text-sm tracking-[0.15em]">Champion</p>
        <h2 class="text-3xl text-imposter font-extrabold my-1">{{ singleWinner.name }}</h2>
      </template>
      <template v-else>
        <p class="text-muted-foreground uppercase text-sm tracking-[0.15em]">Tied!</p>
        <h2 class="text-3xl text-imposter font-extrabold my-1">
          {{ winners.map((w) => w.name).join(' & ') }}
        </h2>
      </template>
      <p class="text-muted text-lg">{{ topScore }} points</p>
      <p class="text-muted-foreground text-sm mt-1">
        Target score: {{ store.room?.targetScore ?? 0 }}
      </p>
    </div>

    <div class="final-scores w-full max-w-85">
      <h3 class="text-muted text-center text-sm mb-3">Final Scores</h3>
      <div
        v-for="(player, index) in sortedPlayers"
        :key="player.id"
        class="flex items-center gap-3 px-3.5 py-2.5 bg-white/4 border border-white/8 rounded-[--radius-md] mb-2"
        :class="{
          'border-imposter/40! bg-imposter/8!': player.score === topScore,
        }"
      >
        <span class="text-muted-foreground font-bold min-w-8">#{{ index + 1 }}</span>
        <span class="flex-1 text-foreground font-medium">{{ player.name }}</span>
        <span class="text-imposter font-extrabold text-xl">{{ player.score }}</span>
      </div>
    </div>

    <!-- Round history -->
    <div v-if="store.room?.roundHistory.length" class="w-full max-w-85">
      <h3 class="text-muted text-center text-sm mb-3">Round History</h3>
      <div
        v-for="(round, index) in store.room.roundHistory"
        :key="index"
        class="flex items-center gap-3 px-3 py-2 bg-white/3 border border-white/6 rounded-[--radius-sm] mb-1.5"
        :class="{
          'border-l-[3px] border-l-success!': round.winner === 'civilians',
          'border-l-[3px] border-l-danger!': round.winner !== 'civilians',
        }"
      >
        <span class="text-muted-foreground text-xs font-bold min-w-8">R{{ index + 1 }}</span>
        <span class="flex-1 text-foreground text-sm">{{ round.secretWord }}</span>
        <span
          class="text-xs font-semibold"
          :class="round.winner === 'civilians' ? 'text-success' : 'text-danger'"
        >
          {{ round.winner === 'civilians' ? 'CIV' : 'IMP' }}
        </span>
      </div>
    </div>

    <button
      v-if="isHost"
      class="ui-btn-primary bg-imposter! hover:bg-imposter-hover! py-4! px-10! text-lg!"
      @click="$emit('restart')"
    >
      Play Again
    </button>
    <p v-else class="text-muted-foreground italic">Waiting for host to restart...</p>
  </div>
</template>
