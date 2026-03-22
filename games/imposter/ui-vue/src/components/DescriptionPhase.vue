<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { PlayerView } from '@shared/types';
import { useGameStore } from '../stores/game';

const store = useGameStore();

const emit = defineEmits<{
  submitDescription: [description: string];
  skipDescriptionTurn: [];
}>();

const description = ref('');
const error = ref('');

const orderedPlayers = computed(() => {
  if (!store.room) {
    return [];
  }

  const playersById = new Map(store.room.players.map((player) => [player.id, player]));
  return store.room.descriptionOrder
    .map((playerId) => playersById.get(playerId))
    .filter((player): player is PlayerView => Boolean(player));
});
const myDescription = computed(() =>
  store.playerId && store.room?.descriptions ? store.room.descriptions[store.playerId] : undefined
);
const wasSkipped = computed(() => myDescription.value === '');
const currentDescriber = computed(
  () =>
    store.room?.players.find(
      (player: PlayerView) => player.id === store.room?.currentDescriberId
    ) ?? null
);
const isMyTurn = computed(() => store.room?.currentDescriberId === store.playerId);

watch(
  () => store.room?.currentDescriberId,
  (currentDescriberId) => {
    if (currentDescriberId === store.playerId) {
      error.value = '';
      description.value = '';
    }
  }
);

function handleSubmit() {
  const trimmed = description.value.trim();
  if (!trimmed) {
    error.value = 'Enter a description';
    return;
  }
  if (trimmed.length > 30) {
    error.value = 'Max 30 characters';
    return;
  }
  error.value = '';
  emit('submitDescription', trimmed);
}
</script>

<template>
  <div class="flex flex-col items-center gap-6 px-4 py-8 min-h-dvh bg-gradient-to-br from-imposter-gradient-1 via-imposter-gradient-2 to-imposter-gradient-3">
    <div class="bg-imposter-muted text-imposter px-4 py-1.5 rounded-full text-sm font-bold tracking-wide uppercase border border-imposter/30">
      Round {{ store.room?.roundNumber }}
    </div>

    <!-- Word reveal -->
    <div class="w-full max-w-[360px] p-5 bg-white/[0.04] border border-white/[0.08] rounded-[--radius-xl] text-center">
      <template v-if="store.myWord">
        <p class="text-muted-foreground text-sm uppercase tracking-[0.15em] mb-2">The Secret Word</p>
        <h1 class="text-4xl font-black text-success mb-3">{{ store.myWord }}</h1>
        <p class="inline-block px-3 py-1 rounded-lg text-sm font-semibold bg-success-muted text-success border border-success/30">You are a Civilian</p>
      </template>
      <template v-else>
        <p class="text-muted-foreground text-sm uppercase tracking-[0.15em] mb-2">Your Role</p>
        <h1 class="text-4xl font-black text-danger mb-3">???</h1>
        <p class="inline-block px-3 py-1 rounded-lg text-sm font-semibold bg-danger-muted text-danger border border-danger/30">You are the Imposter</p>
        <p class="text-muted text-sm mt-2">Listen to each clue as it appears and blend in.</p>
      </template>
    </div>

    <!-- Turn card -->
    <div class="w-full max-w-[360px] p-5 bg-white/[0.04] border border-white/[0.08] rounded-[--radius-xl]">
      <p class="text-muted-foreground text-sm uppercase tracking-[0.15em] mb-2">Current Turn</p>
      <h2 class="text-foreground text-xl font-bold mb-1">{{ currentDescriber?.name ?? 'Waiting...' }}</h2>
      <p class="text-muted text-sm">
        {{ isMyTurn ? 'Enter your clue now.' : currentDescriber ? `Waiting for ${currentDescriber.name} to enter a clue.` : 'Preparing the next clue.' }}
      </p>
      <button
        v-if="store.isHost && store.room?.currentDescriberId"
        class="ui-btn-secondary mt-3 hover:!border-imposter hover:!text-imposter"
        @click="$emit('skipDescriptionTurn')"
      >
        Skip Turn
      </button>
    </div>

    <!-- Description input -->
    <div v-if="isMyTurn" class="w-full max-w-[360px]">
      <label class="text-muted text-sm block mb-2">
        {{ store.myWord ? 'Describe the word (be subtle!)' : 'Write a convincing description' }}
      </label>
      <div class="flex gap-2">
        <input
          v-model="description"
          type="text"
          :placeholder="store.myWord ? 'Your clue...' : 'Blend in...'"
          maxlength="30"
          class="ui-input !bg-white/5 !border-white/10 focus:!border-imposter flex-1"
          @keyup.enter="handleSubmit"
        />
        <button id="btn-submit-description" class="ui-btn-primary !bg-imposter hover:!bg-imposter-hover" @click="handleSubmit">
          Submit
        </button>
      </div>
      <p class="text-xs text-right mt-1" :class="description.length > 25 ? 'text-imposter' : 'text-muted-foreground'">
        {{ description.length }}/30
      </p>
      <p v-if="error" class="text-danger text-xs mt-1">{{ error }}</p>
    </div>

    <!-- Submitted notice -->
    <div v-else-if="store.hasSubmittedDescription" class="w-full max-w-[360px] p-5 bg-white/[0.04] border border-white/[0.08] rounded-[--radius-xl] text-center">
      <p class="text-success font-semibold">
        {{ wasSkipped ? 'Your turn was skipped by the host.' : 'Clue submitted. Waiting for the next player.' }}
      </p>
    </div>

    <!-- Clue board -->
    <div class="w-full max-w-[360px] p-5 bg-white/[0.04] border border-white/[0.08] rounded-[--radius-xl]">
      <h3 class="text-foreground text-base mb-3">Clues in Order</h3>
      <div class="flex flex-col gap-2">
        <div
          v-for="player in orderedPlayers"
          :key="player.id"
          class="flex flex-col gap-0.5 px-3.5 py-3 rounded-[--radius-lg] bg-white/[0.03] border border-white/[0.06]"
          :class="{ '!border-imposter/35 !bg-imposter/[0.08]': player.id === store.room?.currentDescriberId }"
        >
          <span class="text-muted text-xs font-semibold">{{ player.name }}</span>
          <span class="text-foreground text-base min-h-[1.2rem]">
            {{ store.room?.descriptions?.[player.id] === '' ? 'Skipped by host' : (store.room?.descriptions?.[player.id] ?? '...') }}
          </span>
        </div>
      </div>
    </div>

    <!-- Progress -->
    <div class="w-full max-w-[360px] p-5 bg-white/[0.04] border border-white/[0.08] rounded-[--radius-xl]">
      <h3 class="text-foreground text-base mb-3">Clue Progress</h3>
      <div class="ui-progress-track">
        <div
          class="ui-progress-fill !bg-imposter"
          :style="{ width: `${((store.room?.submittedDescriptionIds.length ?? 0) / (store.connectedPlayers.length || 1)) * 100}%` }"
        ></div>
      </div>
      <p class="text-muted text-sm mt-2">
        {{ store.room?.submittedDescriptionIds.length ?? 0 }} / {{ store.connectedPlayers.length }} submitted
      </p>
    </div>
  </div>
</template>
