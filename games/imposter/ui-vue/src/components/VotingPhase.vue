<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import type { PlayerView } from '@shared/types';
import { useGameStore } from '../stores/game';

const store = useGameStore();

const emit = defineEmits<{
  submitVote: [targetId: string];
}>();

const selectedTarget = ref<string | null>(null);
const now = ref(Date.now());
let timerInterval: ReturnType<typeof setInterval> | null = null;

onMounted(() => {
  timerInterval = setInterval(() => {
    now.value = Date.now();
  }, 1000);
});

onUnmounted(() => {
  if (timerInterval) clearInterval(timerInterval);
});

const isDiscussion = computed(() => store.phase === 'discussion');
const isVoting = computed(() => store.phase === 'voting');

const timeRemaining = computed(() => {
  if (!store.room?.discussionEndsAt) return 0;
  return Math.max(0, Math.ceil((store.room.discussionEndsAt - now.value) / 1000));
});

const timerPercent = computed(() => {
  return (
    (timeRemaining.value /
      (store.room?.discussionDurationMs ? store.room.discussionDurationMs / 1000 : 1)) *
    100
  );
});

const orderedPlayers = computed(() => {
  if (!store.room) {
    return [];
  }

  const playersById = new Map(store.room.players.map((player) => [player.id, player]));
  return store.room.descriptionOrder
    .map((playerId) => playersById.get(playerId))
    .filter((player): player is PlayerView => Boolean(player));
});

const otherPlayers = computed(() => {
  return (
    store.room?.players.filter((p: PlayerView) => p.id !== store.playerId && p.connected) ?? []
  );
});

function handleVote() {
  if (!selectedTarget.value || store.hasVoted) return;
  emit('submitVote', selectedTarget.value);
}

function getDescriptionText(playerId: string): string {
  const description = store.room?.descriptions?.[playerId];
  if (description === '') {
    return 'Skipped by host';
  }
  return description ?? '...';
}
</script>

<template>
  <div class="flex flex-col items-center gap-6 px-4 py-8 min-h-dvh bg-gradient-to-br from-imposter-gradient-1 via-imposter-gradient-2 to-imposter-gradient-3">
    <div class="bg-imposter-muted text-imposter px-4 py-1.5 rounded-full text-sm font-bold tracking-wide uppercase border border-imposter/30">
      Round {{ store.room?.roundNumber }}
    </div>

    <!-- Descriptions display -->
    <div class="w-full max-w-[400px]">
      <h2 class="text-foreground text-lg mb-4 text-center">Descriptions</h2>
      <div class="flex flex-col gap-2">
        <div
          v-for="player in orderedPlayers"
          :key="player.id"
          class="px-4 py-3 bg-white/[0.04] border border-white/[0.08] rounded-[--radius-lg] transition-all"
          :class="{ '!border-imposter/30 !bg-imposter/5': player.id === store.playerId }"
        >
          <div class="flex items-center gap-2 mb-1">
            <span class="text-muted text-xs font-semibold">{{ player.name }}</span>
            <span v-if="player.id === store.playerId" class="ui-badge bg-imposter-muted text-imposter">You</span>
          </div>
          <p class="text-foreground text-base font-medium">
            {{ getDescriptionText(player.id) }}
          </p>
        </div>
      </div>
      <p class="text-muted-foreground text-xs mt-3 text-center">
        Clues are shown in the shared round order so everyone reads the same list.
      </p>
    </div>

    <!-- Discussion Timer -->
    <div v-if="isDiscussion" class="w-full max-w-[400px]">
      <h2 class="text-foreground text-lg mb-4 text-center">Discussion Time</h2>
      <div class="flex flex-col items-center gap-4">
        <div class="relative w-[120px] h-[120px]">
          <svg viewBox="0 0 100 100" class="w-full h-full -rotate-90">
            <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="6" />
            <circle
              cx="50" cy="50" r="42"
              fill="none" stroke-width="6" stroke-linecap="round"
              class="transition-[stroke-dasharray] duration-1000 linear"
              :style="{
                strokeDasharray: `${timerPercent * 2.64} 264`,
                stroke: timeRemaining < 10 ? '#ef4444' : 'var(--color-imposter)',
              }"
            />
          </svg>
          <span class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-4xl font-black" :class="timeRemaining < 10 ? 'text-danger animate-pulse' : 'text-imposter'">
            {{ timeRemaining }}
          </span>
        </div>
        <p class="text-muted-foreground text-sm italic">Discuss who might be the Imposter!</p>
      </div>
    </div>

    <!-- Voting -->
    <div v-if="isVoting" class="w-full max-w-[400px]">
      <h2 class="text-foreground text-lg mb-4 text-center">Cast Your Vote</h2>

      <div v-if="!store.hasVoted" class="flex flex-col gap-2">
        <button
          v-for="player in otherPlayers"
          :key="player.id"
          class="flex items-center justify-between px-4 py-3.5 bg-white/[0.04] border-2 border-white/10 rounded-[--radius-lg] cursor-pointer text-foreground text-base transition-all hover:border-imposter/40 hover:bg-imposter/5"
          :class="{ '!border-imposter !bg-imposter/10': selectedTarget === player.id }"
          @click="selectedTarget = player.id"
        >
          <span class="font-medium">{{ player.name }}</span>
          <span v-if="selectedTarget === player.id" class="text-imposter font-bold text-lg">âœ“</span>
        </button>
        <button
          id="btn-confirm-vote"
          class="ui-btn-primary !bg-imposter hover:!bg-imposter-hover w-full !py-4 mt-3"
          :disabled="!selectedTarget"
          @click="handleVote"
        >
          Confirm Vote
        </button>
      </div>

      <div v-else class="text-center p-4 bg-success-muted border border-success/20 rounded-[--radius-lg]">
        <p class="text-success font-semibold">Vote submitted!</p>
      </div>

      <div class="mt-4 text-center">
        <p class="text-muted-foreground text-xs mb-2">
          {{ store.room?.submittedVoteIds.length ?? 0 }} / {{ store.connectedPlayers.length }} voted
        </p>
        <div class="ui-progress-track">
          <div
            class="ui-progress-fill !bg-imposter"
            :style="{ width: `${((store.room?.submittedVoteIds.length ?? 0) / (store.connectedPlayers.length || 1)) * 100}%` }"
          ></div>
        </div>
      </div>
    </div>
  </div>
</template>
