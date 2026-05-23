<script setup lang="ts">
import { computed } from 'vue';
import type { ScoutCard } from '@shared/deck';

const props = withDefaults(
  defineProps<{
    card?: ScoutCard | null;
    faceDown?: boolean;
    selected?: boolean;
    disabled?: boolean;
    compact?: boolean;
  }>(),
  {
    card: null,
    faceDown: false,
    selected: false,
    disabled: false,
    compact: false,
  }
);

const cardClasses = computed(() => [
  props.compact ? 'h-20 w-14' : 'h-28 w-20',
  props.selected
    ? 'border-scout shadow-[0_0_22px_rgba(20,184,166,0.45)] -translate-y-2'
    : 'border-border-strong',
  props.disabled ? 'opacity-60' : '',
]);
</script>

<template>
  <div
    class="relative flex shrink-0 select-none flex-col justify-between rounded-xl border bg-elevated p-2 text-foreground shadow-elevated transition-all"
    :class="cardClasses"
  >
    <template v-if="faceDown || !card">
      <div
        class="grid h-full place-items-center rounded-lg border border-scout/30 bg-scout-muted text-xl"
      >
        🎯
      </div>
    </template>
    <template v-else>
      <span class="font-mono text-xl font-bold text-scout">{{ card.playValue }}</span>
      <span class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-xs text-muted">
        play
      </span>
      <span class="self-end font-mono text-lg font-semibold text-warning">{{
        card.scoutPoints
      }}</span>
    </template>
  </div>
</template>
