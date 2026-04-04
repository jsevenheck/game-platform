<script setup lang="ts">
import { ref, computed } from 'vue';
import type { PlayerView } from '@shared/types';
import {
  MIN_DISCUSSION_DURATION_MS,
  MAX_DISCUSSION_DURATION_MS,
  DISCUSSION_DURATION_STEP_MS,
  MIN_TARGET_SCORE,
  MAX_TARGET_SCORE,
} from '@shared/constants';
import { useGameStore } from '../stores/game';

withDefaults(
  defineProps<{
    errorMessage?: string;
  }>(),
  {
    errorMessage: '',
  }
);

const store = useGameStore();

const emit = defineEmits<{
  startGame: [];
  configureLobby: [
    config: { infiltratorCount: number; discussionDurationMs: number; targetScore: number },
  ];
  submitWord: [word: string];
  kickPlayer: [playerId: string];
}>();

const isHost = computed(
  () => store.room?.players.find((p: PlayerView) => p.id === store.playerId)?.isHost ?? false
);

const connectedCount = computed(
  () => store.room?.players.filter((p: PlayerView) => p.connected).length ?? 0
);

const MIN_PLAYERS = 3;

const newWord = ref('');
const infiltratorCount = computed(() => store.room?.infiltratorCount ?? 1);
const discussionDurationMs = computed(
  () => store.room?.discussionDurationMs ?? MIN_DISCUSSION_DURATION_MS
);
const targetScore = computed(() => store.room?.targetScore ?? MIN_TARGET_SCORE);

function handleConfigChange(
  nextConfig?: Partial<{
    infiltratorCount: number;
    discussionDurationMs: number;
    targetScore: number;
  }>
) {
  emit('configureLobby', {
    infiltratorCount: nextConfig?.infiltratorCount ?? infiltratorCount.value,
    discussionDurationMs: nextConfig?.discussionDurationMs ?? discussionDurationMs.value,
    targetScore: nextConfig?.targetScore ?? targetScore.value,
  });
}

function handleSubmitWord() {
  const word = newWord.value.trim();
  if (!word) return;
  emit('submitWord', word);
  newWord.value = '';
}
</script>

<template>
  <div
    class="lobby flex flex-col items-center gap-6 px-4 py-8 min-h-dvh bg-gradient-to-br from-imposter-gradient-1 via-imposter-gradient-2 to-imposter-gradient-3"
  >
    <div class="text-center">
      <h2 class="text-3xl font-black text-imposter">Imposter</h2>
    </div>

    <div class="w-full max-w-[340px]">
      <h3 class="text-muted text-sm mb-3">Players ({{ connectedCount }})</h3>
      <div
        v-for="player in store.room?.players"
        :key="player.id"
        class="flex items-center gap-2 px-3.5 py-2.5 bg-white/5 border border-white/[0.08] rounded-[--radius-md] mb-2 transition-all"
        :class="{ 'opacity-40': !player.connected }"
      >
        <span class="flex-1 text-foreground font-medium">{{ player.name }}</span>
        <button
          v-if="isHost && player.id !== store.playerId"
          class="ui-badge bg-danger-muted text-danger cursor-pointer border-none hover:bg-danger/30"
          type="button"
          @click="$emit('kickPlayer', player.id)"
        >
          Kick
        </button>
        <span v-if="player.isHost" class="ui-badge bg-imposter text-white">Host</span>
        <span v-if="!player.connected" class="ui-badge bg-white/10 text-muted-foreground"
          >Offline</span
        >
      </div>
    </div>

    <!-- Host controls -->
    <div v-if="isHost" class="flex flex-col items-center gap-6 w-full max-w-[340px]">
      <div class="w-full p-5 bg-white/[0.04] border border-white/[0.08] rounded-[--radius-lg]">
        <h3 class="text-foreground text-base mb-4">Game Settings</h3>

        <div class="flex items-center justify-between mb-4">
          <label class="text-muted text-sm font-medium">
            Infiltrators
            <span class="text-muted-foreground text-xs">
              {{ infiltratorCount === 0 ? '(Paranoia Mode!)' : '' }}
            </span>
          </label>
          <div class="flex items-center gap-3">
            <button
              class="stepper-btn ui-stepper-btn hover:border-imposter!"
              :disabled="infiltratorCount <= 0"
              @click="handleConfigChange({ infiltratorCount: infiltratorCount - 1 })"
            >
              -
            </button>
            <span class="text-imposter text-2xl font-extrabold min-w-[2rem] text-center">{{
              infiltratorCount
            }}</span>
            <button
              class="stepper-btn ui-stepper-btn hover:border-imposter!"
              :disabled="infiltratorCount >= Math.max(connectedCount - 1, 1)"
              @click="handleConfigChange({ infiltratorCount: infiltratorCount + 1 })"
            >
              +
            </button>
          </div>
        </div>

        <div class="flex items-center justify-between mb-4">
          <label class="text-muted text-sm font-medium">Discussion Timer</label>
          <div class="flex items-center gap-3">
            <button
              class="stepper-btn ui-stepper-btn hover:border-imposter!"
              :disabled="discussionDurationMs <= MIN_DISCUSSION_DURATION_MS"
              @click="
                handleConfigChange({
                  discussionDurationMs: discussionDurationMs - DISCUSSION_DURATION_STEP_MS,
                })
              "
            >
              -
            </button>
            <span class="text-imposter text-2xl font-extrabold min-w-[3.5rem] text-center"
              >{{ discussionDurationMs / 1000 }}s</span
            >
            <button
              class="stepper-btn ui-stepper-btn hover:border-imposter!"
              :disabled="discussionDurationMs >= MAX_DISCUSSION_DURATION_MS"
              @click="
                handleConfigChange({
                  discussionDurationMs: discussionDurationMs + DISCUSSION_DURATION_STEP_MS,
                })
              "
            >
              +
            </button>
          </div>
        </div>

        <div class="flex items-center justify-between mb-4">
          <label class="text-muted text-sm font-medium">Target Score</label>
          <div class="flex items-center gap-3">
            <button
              class="stepper-btn ui-stepper-btn hover:border-imposter!"
              :disabled="targetScore <= MIN_TARGET_SCORE"
              @click="handleConfigChange({ targetScore: targetScore - 1 })"
            >
              -
            </button>
            <span class="text-imposter text-2xl font-extrabold min-w-[2rem] text-center">{{
              targetScore
            }}</span>
            <button
              class="stepper-btn ui-stepper-btn hover:border-imposter!"
              :disabled="targetScore >= MAX_TARGET_SCORE"
              @click="handleConfigChange({ targetScore: targetScore + 1 })"
            >
              +
            </button>
          </div>
        </div>
        <p v-if="errorMessage" class="text-danger text-xs mb-3">{{ errorMessage }}</p>
        <p class="text-muted-foreground text-xs mt-1">
          First player to {{ targetScore }} points wins the match.
        </p>

        <div class="mt-2">
          <label class="text-muted text-sm font-medium block mb-2">Add a Custom Word</label>
          <div class="flex gap-2">
            <input
              v-model="newWord"
              type="text"
              placeholder="Enter a word..."
              maxlength="40"
              class="ui-input bg-white/5! border-white/10! focus:border-imposter! flex-1 text-sm!"
              @keyup.enter="handleSubmitWord"
            />
            <button
              class="ui-btn-primary bg-imposter! hover:bg-imposter-hover! px-4! py-2.5! text-sm!"
              @click="handleSubmitWord"
            >
              Add
            </button>
          </div>
          <p class="text-muted-foreground text-xs mt-1">
            {{ store.room?.wordLibraryCount ?? 0 }} words in library
          </p>
        </div>
      </div>

      <button
        id="btn-start-game"
        class="ui-btn-primary bg-imposter! hover:bg-imposter-hover! w-full py-4! text-lg!"
        :disabled="connectedCount < MIN_PLAYERS"
        @click="$emit('startGame')"
      >
        Start Game
      </button>
      <p v-if="connectedCount < MIN_PLAYERS" class="text-muted-foreground text-sm">
        Need at least {{ MIN_PLAYERS }} players to start
      </p>
    </div>

    <!-- Non-host: also allow word submission -->
    <div v-else class="w-full max-w-[340px] flex flex-col gap-4">
      <div>
        <label class="text-muted text-sm font-medium block mb-2">Suggest a Word</label>
        <div class="flex gap-2">
          <input
            v-model="newWord"
            type="text"
            placeholder="Enter a word..."
            maxlength="40"
            class="ui-input bg-white/5! border-white/10! focus:border-imposter! flex-1 text-sm!"
            @keyup.enter="handleSubmitWord"
          />
          <button
            class="ui-btn-primary bg-imposter! hover:bg-imposter-hover! px-4! py-2.5! text-sm!"
            @click="handleSubmitWord"
          >
            Add
          </button>
        </div>
        <p class="text-muted-foreground text-xs mt-1">
          {{ store.room?.wordLibraryCount ?? 0 }} words in library
        </p>
      </div>
      <div class="text-center text-muted-foreground italic">
        <p>Waiting for host to start the game...</p>
      </div>
    </div>
  </div>
</template>
