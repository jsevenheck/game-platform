<script setup lang="ts">
import { computed } from 'vue';
import { useGameStore } from '../stores/game';

const store = useGameStore();

defineEmits<{
  reveal: [];
  reroll: [];
  selectWinner: [winnerId: string];
  skip: [];
}>();

const round = computed(() => store.currentRound);
const isReader = computed(() => store.isReader);
const canSkip = computed(() => store.isHost || store.isOwner);

const taskText = computed(() => {
  if (!round.value?.task) return '';
  const letter = round.value.letter ?? '';
  return round.value.task.text.replace('{letter}', letter);
});

const isCategoryReused = computed(() => {
  const id = round.value?.category?.id;
  if (!id) return false;
  return store.room?.usedCategoryIds.includes(id) ?? false;
});

const selectablePlayers = computed(() => {
  const currentRound = round.value;
  const players = store.room?.players ?? [];
  if (!currentRound) return [];
  return players.filter((player) => player.id !== currentRound.readerId && player.connected);
});
</script>

<template>
  <div class="game-round flex flex-col items-center gap-6 px-4 py-8">
    <!-- Pre-reveal: Host sees category, others wait -->
    <template v-if="!round?.revealed">
      <div v-if="isReader" class="flex flex-col items-center gap-6">
        <p class="uppercase tracking-wide text-muted">You are the Host!</p>
        <div
          class="rounded-[--radius-lg] border-2 border-blackout bg-elevated px-12 py-8 text-center"
        >
          <span
            v-if="isCategoryReused"
            class="mb-2 inline-block rounded-pill bg-danger-muted px-3 py-0.5 text-[0.7rem] font-bold uppercase tracking-wide text-danger"
            >Already played</span
          >
          <p class="mb-2 text-2xl text-foreground">{{ round?.category?.name }}</p>
          <p class="mb-1 text-blackout">{{ taskText }}</p>
          <p v-if="round?.letter" class="text-6xl font-black text-blackout">{{ round?.letter }}</p>
        </div>
        <button
          class="ui-btn-primary !bg-blackout px-12 py-4 text-2xl hover:!bg-blackout-hover"
          @click="$emit('reveal')"
        >
          Reveal!
        </button>
        <button class="ui-btn-secondary" @click="$emit('reroll')">New Task + Category</button>
        <button v-if="canSkip" class="btn-skip ui-btn-ghost mt-4" @click="$emit('skip')">
          Skip Round
        </button>
        <p class="text-sm text-muted-foreground">Click to reveal the prompt to all players</p>
      </div>
      <div v-else class="flex flex-col items-center gap-6">
        <p class="uppercase tracking-wide text-muted">Waiting for the host to reveal...</p>
        <p class="text-xl font-semibold text-blackout">
          Host: {{ store.room?.players.find((p) => p.id === round?.readerId)?.name }}
        </p>
        <button v-if="canSkip" class="btn-skip ui-btn-ghost" @click="$emit('skip')">
          Skip Round
        </button>
      </div>
    </template>

    <!-- Post-reveal: Host picks the winner -->
    <template v-else>
      <div class="flex flex-col items-center gap-6">
        <div class="text-center">
          <span
            v-if="isCategoryReused"
            class="mb-2 inline-block rounded-pill bg-danger-muted px-3 py-0.5 text-[0.7rem] font-bold uppercase tracking-wide text-danger"
            >Already played</span
          >
          <p class="mb-2 text-2xl text-foreground">{{ round?.category?.name }}</p>
          <p class="mb-1 text-blackout">{{ taskText }}</p>
          <p
            v-if="round?.letter"
            class="text-7xl font-black text-blackout"
            style="text-shadow: 0 0 30px rgba(139, 92, 246, 0.4)"
          >
            {{ round?.letter }}
          </p>
        </div>

        <div v-if="isReader" class="w-full max-w-[min(92vw,560px)]">
          <h3 class="mb-2 text-center text-muted">Who was correct?</h3>
          <div
            v-for="player in selectablePlayers"
            :key="player.id"
            class="mb-2 flex items-center gap-3 rounded-[--radius-md] bg-elevated p-4"
          >
            <span class="min-w-0 flex-1 truncate text-2xl text-foreground sm:text-xl">{{
              player.name
            }}</span>
            <button
              class="inline-flex items-center justify-center gap-2 rounded-[--radius-lg] bg-success px-4 py-2.5 font-semibold text-white transition-all hover:opacity-90 cursor-pointer select-none"
              @click="$emit('selectWinner', player.id)"
            >
              Correct!
            </button>
          </div>
        </div>
        <p v-else class="text-sm text-muted-foreground">
          Speak your answer out loud. Host will select the correct player.
        </p>

        <!-- Host controls -->
        <div v-if="isReader || canSkip" class="mt-4 flex flex-col items-center gap-3">
          <button v-if="isReader" class="ui-btn-secondary" @click="$emit('reroll')">
            New Task + Category
          </button>
          <button v-if="canSkip" class="btn-skip ui-btn-ghost" @click="$emit('skip')">
            Skip Round
          </button>
        </div>
      </div>
    </template>
  </div>
</template>
