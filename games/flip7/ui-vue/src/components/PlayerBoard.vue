<script setup lang="ts">
import { computed } from 'vue';
import type { RoundPlayerView, PlayerView } from '@shared/types';

const props = defineProps<{
  roundPlayer: RoundPlayerView;
  player: PlayerView;
  isCurrentTurn: boolean;
  isMe: boolean;
}>();

/** Returns colour classes for a number card chip based on risk/value. */
function numberCardClasses(n: number): string {
  // 0–4 → safe (green)
  if (n <= 4) return 'bg-success-muted text-success ring-1 ring-success';
  // 5–8 → medium risk (amber)
  if (n <= 8) return 'bg-warning-muted text-warning ring-1 ring-warning';
  // 9–12 → high risk (red)
  return 'bg-danger-muted text-danger ring-1 ring-danger';
}

/** Score the player would earn if they stayed right now. */
const liveScore = computed(() => {
  const sum = props.roundPlayer.numberCards.reduce((a, b) => a + b, 0);
  const bonus = props.roundPlayer.modifierAdds.reduce((a, b) => a + b, 0);
  const withBonus = sum + bonus;
  return props.roundPlayer.hasX2 ? withBonus * 2 : withBonus;
});</script>

<template>
  <div
    class="ui-panel flex flex-col gap-3 transition-all duration-200"
    :class="{
      'ring-2 ring-flip7': props.isCurrentTurn && props.roundPlayer.status === 'active',
      'opacity-50': props.roundPlayer.status === 'busted',
    }"
  >
    <!-- Player header -->
    <div class="flex items-center justify-between gap-2">
      <div class="flex items-center gap-2">
        <span
          class="size-2 rounded-full"
          :class="props.player.connected ? 'bg-success' : 'bg-muted'"
        />
        <span class="text-sm font-semibold" :class="props.isMe ? 'text-flip7' : 'text-foreground'">
          {{ props.player.name }}
          <span v-if="props.isMe" class="ml-1 text-xs text-muted-foreground">(you)</span>
        </span>
      </div>
      <div class="flex items-center gap-2">
        <!-- Live round score -->
        <span
          v-if="props.roundPlayer.numberCards.length > 0 && props.roundPlayer.status === 'active'"
          class="text-xs font-bold text-muted-foreground"
          title="Live round score"
        >
          {{ liveScore }} pts
        </span>
        <!-- Status badge -->
        <span v-if="props.roundPlayer.status === 'stayed'" class="ui-badge text-xs text-success">
          Stayed
        </span>
        <span
          v-else-if="props.roundPlayer.status === 'busted'"
          class="ui-badge text-xs text-danger"
        >
          Bust
        </span>
        <span v-else-if="props.isCurrentTurn" class="ui-badge text-xs text-flip7"> ▶ Turn </span>
        <!-- Second Chance token -->
        <span v-if="props.roundPlayer.hasSecondChance" title="Second Chance" class="text-base"
          >🛡️</span
        >
        <!-- Flip Three indicator -->
        <span v-if="props.roundPlayer.flipThreeRemaining > 0" class="ui-badge text-xs text-warning">
          Flip {{ props.roundPlayer.flipThreeRemaining }}
        </span>
      </div>
    </div>

    <!-- Number cards -->
    <div v-if="props.roundPlayer.numberCards.length > 0" class="flex flex-wrap gap-1.5">
      <div
        v-for="n in props.roundPlayer.numberCards"
        :key="n"
        class="flex size-9 items-center justify-center rounded-[--radius-sm] text-sm font-bold transition-colors"
        :class="numberCardClasses(n)"
      >
        {{ n }}
      </div>
    </div>
    <p v-else class="text-xs text-muted-foreground">No cards yet</p>

    <!-- Modifier row -->
    <div
      v-if="props.roundPlayer.hasX2 || props.roundPlayer.modifierAdds.length > 0"
      class="flex flex-wrap gap-1.5"
    >
      <div
        v-if="props.roundPlayer.hasX2"
        class="flex h-7 items-center rounded-[--radius-sm] bg-flip7-muted px-2 text-xs font-bold text-flip7 ring-1 ring-flip7"
      >
        ×2
      </div>
      <div
        v-for="(bonus, i) in props.roundPlayer.modifierAdds"
        :key="'add-' + i"
        class="flex h-7 items-center rounded-[--radius-sm] bg-success-muted px-2 text-xs font-bold text-success ring-1 ring-success"
      >
        +{{ bonus }}
      </div>
    </div>
  </div>
</template>
