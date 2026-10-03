<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import type { PendingActionView, PlayerView } from '@shared/types';
import { useModalDialog } from '@platform/composables/useModalDialog';

const props = defineProps<{
  pendingAction: PendingActionView;
  players: PlayerView[];
  myPlayerId: string;
}>();

const emit = defineEmits<{
  'choose-target': [targetPlayerId: string];
}>();

const { t } = useI18n();

const ACTION_EMOJI: Record<string, string> = {
  freeze: '🥶',
  flipThree: '🎴',
  secondChance: '🛡️',
};

const info = computed(() => {
  const action = props.pendingAction.action;
  const known = action in ACTION_EMOJI;
  return {
    label: known ? t(`flip7.actions.${action}`) : action,
    description: known ? t(`flip7.actions.${action}Description`) : '',
    emoji: ACTION_EMOJI[action] ?? '🃏',
  };
});

const eligiblePlayers = computed(() =>
  props.players.filter((p) => props.pendingAction.eligibleTargets.includes(p.id))
);

const dialogRef = ref<HTMLElement | null>(null);
useModalDialog(dialogRef);
</script>

<template>
  <div class="ui-overlay flex items-center justify-center">
    <div
      ref="dialogRef"
      class="ui-dialog w-full max-w-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="flip7-target-picker-title"
    >
      <div class="mb-4 text-center">
        <span class="text-3xl" aria-hidden="true">{{ info.emoji }}</span>
        <h2 id="flip7-target-picker-title" class="mt-2 text-xl font-bold text-foreground">
          {{ info.label }}
        </h2>
        <p class="mt-1 text-sm text-muted-foreground">{{ info.description }}</p>
        <p class="mt-2 text-sm text-muted">{{ t('flip7.targetPicker.choose') }}</p>
      </div>

      <div class="space-y-2">
        <button
          v-for="player in eligiblePlayers"
          :key="player.id"
          class="w-full rounded-md bg-elevated px-4 py-3 text-left font-medium text-foreground ring-1 ring-border transition hover:bg-elevated hover:ring-flip7"
          type="button"
          @click="emit('choose-target', player.id)"
        >
          <span class="flex items-center gap-2">
            <span
              class="size-2 rounded-full"
              :class="player.connected ? 'bg-success' : 'bg-muted'"
            />
            {{ player.name }}
            <span v-if="player.id === myPlayerId" class="ml-auto text-xs text-muted-foreground">{{
              t('flip7.targetPicker.you')
            }}</span>
          </span>
        </button>
      </div>
    </div>
  </div>
</template>
