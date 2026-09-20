<script setup lang="ts">
import { ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { PlayerView } from '@shared/types';
import {
  MIN_DISCUSSION_DURATION_MS,
  MAX_DISCUSSION_DURATION_MS,
  DISCUSSION_DURATION_STEP_MS,
  MIN_TARGET_SCORE,
  MAX_TARGET_SCORE,
  MAX_INFILTRATOR_COUNT,
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

const { t } = useI18n();
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
    class="lobby flex flex-col items-center gap-6 px-4 py-8 min-h-dvh bg-linear-to-br from-imposter-gradient-1 via-imposter-gradient-2 to-imposter-gradient-3"
  >
    <div class="text-center">
      <h2 class="text-3xl font-black text-imposter">{{ t('imposter.lobby.title') }}</h2>
    </div>

    <div class="w-full max-w-85">
      <h3 class="text-muted text-sm mb-3">
        {{ t('imposter.lobby.players', { count: connectedCount }) }}
      </h3>
      <div
        v-for="player in store.room?.players"
        :key="player.id"
        class="flex items-center gap-2 px-3.5 py-2.5 bg-white/5 border border-white/8 rounded-md mb-2 transition-all"
        :class="{ 'opacity-40': !player.connected }"
      >
        <span class="flex-1 text-foreground font-medium">{{ player.name }}</span>
        <button
          v-if="isHost && player.id !== store.playerId"
          class="ui-badge min-h-9 min-w-14 justify-center bg-danger-muted text-danger cursor-pointer border-none hover:bg-danger/30"
          type="button"
          :aria-label="t('imposter.lobby.kickPlayer', { name: player.name })"
          @click="$emit('kickPlayer', player.id)"
        >
          {{ t('imposter.lobby.kick') }}
        </button>
        <span v-if="player.isHost" class="ui-badge bg-imposter text-white">{{
          t('imposter.common.host')
        }}</span>
        <span v-if="!player.connected" class="ui-badge bg-white/10 text-muted-foreground">{{
          t('imposter.common.offline')
        }}</span>
      </div>
    </div>

    <!-- Host controls -->
    <div v-if="isHost" class="flex flex-col items-center gap-6 w-full max-w-85">
      <div class="w-full p-5 bg-white/4 border border-white/8 rounded-lg">
        <h3 class="text-foreground text-base mb-4">{{ t('imposter.lobby.settings') }}</h3>

        <div class="flex items-center justify-between mb-4">
          <label class="text-muted text-sm font-medium">
            {{ t('imposter.lobby.infiltrators') }}
            <span class="text-muted-foreground text-xs">
              {{ infiltratorCount === 0 ? t('imposter.lobby.paranoia') : '' }}
            </span>
          </label>
          <div class="flex items-center gap-3">
            <button
              class="stepper-btn ui-stepper-btn hover-border-imposter"
              :disabled="infiltratorCount <= 0"
              @click="handleConfigChange({ infiltratorCount: infiltratorCount - 1 })"
            >
              -
            </button>
            <span class="text-imposter text-2xl font-extrabold min-w-8 text-center font-mono-num">{{
              infiltratorCount
            }}</span>
            <button
              class="stepper-btn ui-stepper-btn hover-border-imposter"
              :disabled="
                infiltratorCount >= Math.min(MAX_INFILTRATOR_COUNT, Math.max(connectedCount - 1, 1))
              "
              @click="handleConfigChange({ infiltratorCount: infiltratorCount + 1 })"
            >
              +
            </button>
          </div>
        </div>

        <div class="flex items-center justify-between mb-4">
          <label class="text-muted text-sm font-medium">{{ t('imposter.lobby.timer') }}</label>
          <div class="flex items-center gap-3">
            <button
              class="stepper-btn ui-stepper-btn hover-border-imposter"
              :disabled="discussionDurationMs <= MIN_DISCUSSION_DURATION_MS"
              @click="
                handleConfigChange({
                  discussionDurationMs: discussionDurationMs - DISCUSSION_DURATION_STEP_MS,
                })
              "
            >
              -
            </button>
            <span class="text-imposter text-2xl font-extrabold min-w-14 text-center font-mono-num"
              >{{ discussionDurationMs / 1000 }}s</span
            >
            <button
              class="stepper-btn ui-stepper-btn hover-border-imposter"
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
          <label class="text-muted text-sm font-medium">{{
            t('imposter.lobby.targetScore')
          }}</label>
          <div class="flex items-center gap-3">
            <button
              class="stepper-btn ui-stepper-btn hover-border-imposter"
              :disabled="targetScore <= MIN_TARGET_SCORE"
              @click="handleConfigChange({ targetScore: targetScore - 1 })"
            >
              -
            </button>
            <span class="text-imposter text-2xl font-extrabold min-w-8 text-center font-mono-num">{{
              targetScore
            }}</span>
            <button
              class="stepper-btn ui-stepper-btn hover-border-imposter"
              :disabled="targetScore >= MAX_TARGET_SCORE"
              @click="handleConfigChange({ targetScore: targetScore + 1 })"
            >
              +
            </button>
          </div>
        </div>
        <p v-if="errorMessage" class="text-danger text-xs mb-3">{{ errorMessage }}</p>
        <p class="text-muted-foreground text-xs mt-1">
          {{ t('imposter.lobby.targetHint', { score: targetScore }) }}
        </p>

        <div class="mt-2">
          <label for="imposter-custom-word" class="text-muted text-sm font-medium block mb-2">{{
            t('imposter.lobby.addWord')
          }}</label>
          <div class="flex gap-2">
            <input
              id="imposter-custom-word"
              v-model="newWord"
              type="text"
              :placeholder="t('imposter.lobby.wordPlaceholder')"
              maxlength="40"
              class="ui-input bg-white-5 border-white-10 focus-border-imposter flex-1 text-sm"
              @keyup.enter="handleSubmitWord"
            />
            <button
              class="ui-btn-primary btn-imposter btn-imposter-hover px-4 py-2.5 text-sm"
              @click="handleSubmitWord"
            >
              {{ t('imposter.lobby.add') }}
            </button>
          </div>
          <p class="text-muted-foreground text-xs mt-1">
            {{ t('imposter.lobby.wordCount', { count: store.room?.wordLibraryCount ?? 0 }) }}
          </p>
        </div>
      </div>

      <button
        id="btn-start-game"
        class="ui-btn-primary ui-btn-lg btn-imposter btn-imposter-hover w-full"
        :disabled="connectedCount < MIN_PLAYERS"
        @click="$emit('startGame')"
      >
        {{ t('imposter.lobby.start') }}
      </button>
      <p v-if="connectedCount < MIN_PLAYERS" class="text-muted-foreground text-sm">
        {{ t('imposter.lobby.needPlayers', { min: MIN_PLAYERS }) }}
      </p>
    </div>

    <!-- Non-host: also allow word submission -->
    <div v-else class="w-full max-w-85 flex flex-col gap-4">
      <div>
        <label for="imposter-custom-word" class="text-muted text-sm font-medium block mb-2">{{
          t('imposter.lobby.suggestWord')
        }}</label>
        <div class="flex gap-2">
          <input
            id="imposter-custom-word"
            v-model="newWord"
            type="text"
            :placeholder="t('imposter.lobby.wordPlaceholder')"
            maxlength="40"
            class="ui-input bg-white-5 border-white-10 focus-border-imposter flex-1 text-sm"
            @keyup.enter="handleSubmitWord"
          />
          <button
            class="ui-btn-primary btn-imposter btn-imposter-hover px-4 py-2.5 text-sm"
            @click="handleSubmitWord"
          >
            {{ t('imposter.lobby.add') }}
          </button>
        </div>
        <p class="text-muted-foreground text-xs mt-1">
          {{ t('imposter.lobby.wordCount', { count: store.room?.wordLibraryCount ?? 0 }) }}
        </p>
      </div>
      <div class="text-center text-muted-foreground italic">
        <p>{{ t('imposter.lobby.waitingForHost') }}</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.btn-imposter {
  background: var(--color-imposter);
}
.btn-imposter-hover:hover:not(:disabled) {
  background: var(--color-imposter-hover);
}
.hover-border-imposter:hover {
  border-color: var(--color-imposter);
}
.hover-text-imposter:hover {
  color: var(--color-imposter);
}
.focus-border-imposter:focus {
  border-color: var(--color-imposter);
}
.bg-white-5 {
  background: rgba(255, 255, 255, 0.05);
}
.border-white-10 {
  border-color: rgba(255, 255, 255, 0.1);
}
.signals-active {
  border-color: var(--color-imposter);
  background: rgba(239, 68, 68, 0.1);
}
</style>
