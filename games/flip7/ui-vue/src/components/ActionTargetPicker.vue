<script setup lang="ts">
import { computed } from 'vue';
import type { PendingActionView, PlayerView } from '@shared/types';

const props = defineProps<{
  pendingAction: PendingActionView;
  players: PlayerView[];
  myPlayerId: string;
}>();

const emit = defineEmits<{
  'choose-target': [targetPlayerId: string];
}>();

const ACTION_LABELS: Record<string, { label: string; description: string; emoji: string }> = {
  freeze: { label: 'Freeze', description: 'Force a player to Stay immediately', emoji: '🥶' },
  flipThree: { label: 'Flip Three', description: 'Force a player to draw 3 cards', emoji: '🎴' },
  secondChance: {
    label: 'Second Chance',
    description: 'Give a player a bust protection token',
    emoji: '🛡️',
  },
};

const info = computed(
  () =>
    ACTION_LABELS[props.pendingAction.action] ?? {
      label: props.pendingAction.action,
      description: '',
      emoji: '🃏',
    }
);

const eligiblePlayers = computed(() =>
  props.players.filter((p) => props.pendingAction.eligibleTargets.includes(p.id))
);
</script>

<template>
  <div class="ui-overlay flex items-center justify-center">
    <div class="ui-dialog w-full max-w-sm">
      <div class="mb-4 text-center">
        <span class="text-3xl">{{ info.emoji }}</span>
        <h2 class="mt-2 text-xl font-bold text-foreground">{{ info.label }}</h2>
        <p class="mt-1 text-sm text-muted-foreground">{{ info.description }}</p>
        <p class="mt-2 text-sm text-muted">Choose a target:</p>
      </div>

      <div class="space-y-2">
        <button
          v-for="player in eligiblePlayers"
          :key="player.id"
          class="w-full rounded-[--radius-md] bg-elevated px-4 py-3 text-left font-medium text-foreground ring-1 ring-border transition hover:bg-elevated hover:ring-flip7"
          type="button"
          @click="emit('choose-target', player.id)"
        >
          <span class="flex items-center gap-2">
            <span
              class="size-2 rounded-full"
              :class="player.connected ? 'bg-success' : 'bg-muted'"
            />
            {{ player.name }}
            <span v-if="player.id === myPlayerId" class="ml-auto text-xs text-muted-foreground"
              >you</span
            >
          </span>
        </button>
      </div>
    </div>
  </div>
</template>
