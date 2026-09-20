<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { RoundPlayerView, PlayerView } from '@shared/types';

const props = defineProps<{
  roundPlayer: RoundPlayerView;
  player: PlayerView;
  isCurrentTurn: boolean;
  isMe: boolean;
}>();

const { t } = useI18n();

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
});
</script>

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
          <span v-if="props.isMe" class="ml-1 text-xs text-muted-foreground">{{
            t('flip7.board.you')
          }}</span>
        </span>
      </div>
      <div class="flex items-center gap-2">
        <!-- Live round score -->
        <span
          v-if="props.roundPlayer.numberCards.length > 0 && props.roundPlayer.status === 'active'"
          class="text-xs font-bold text-muted-foreground"
          :title="t('flip7.board.liveScore')"
        >
          {{ t('flip7.board.pts', { score: liveScore }) }}
        </span>
        <!-- Status badge -->
        <span v-if="props.roundPlayer.status === 'stayed'" class="ui-badge text-xs text-success">
          {{ t('flip7.board.stayed') }}
        </span>
        <span
          v-else-if="props.roundPlayer.status === 'busted'"
          class="ui-badge text-xs text-danger"
        >
          {{ t('flip7.board.bust') }}
        </span>
        <span v-else-if="props.isCurrentTurn" class="ui-badge text-xs text-flip7">
          {{ t('flip7.board.turn') }}
        </span>
        <!-- Second Chance token -->
        <span
          v-if="props.roundPlayer.hasSecondChance"
          :title="t('flip7.board.secondChance')"
          class="text-base"
          >🛡️</span
        >
        <!-- Flip Three indicator -->
        <span v-if="props.roundPlayer.flipThreeRemaining > 0" class="ui-badge text-xs text-warning">
          {{ t('flip7.board.flip', { count: props.roundPlayer.flipThreeRemaining }) }}
        </span>
      </div>
    </div>

    <!-- Number cards -->
    <div v-if="props.roundPlayer.numberCards.length > 0" class="flex flex-wrap gap-1.5">
      <div
        v-for="n in props.roundPlayer.numberCards"
        :key="n"
        class="flex h-14 w-11 items-center justify-center rounded-sm text-lg font-bold transition-colors sm:h-16 sm:w-12 sm:text-xl"
        :class="numberCardClasses(n)"
      >
        {{ n }}
      </div>
    </div>
    <p v-else class="text-xs text-muted-foreground">{{ t('flip7.board.noCards') }}</p>

    <!-- Modifier row -->
    <div
      v-if="props.roundPlayer.hasX2 || props.roundPlayer.modifierAdds.length > 0"
      class="flex flex-wrap gap-1.5"
    >
      <div
        v-if="props.roundPlayer.hasX2"
        class="flex h-8 items-center rounded-sm bg-flip7-muted px-2.5 text-sm font-bold text-flip7 ring-1 ring-flip7"
      >
        ×2
      </div>
      <div
        v-for="(bonus, i) in props.roundPlayer.modifierAdds"
        :key="'add-' + i"
        class="flex h-8 items-center rounded-sm bg-success-muted px-2.5 text-sm font-bold text-success ring-1 ring-success"
      >
        +{{ bonus }}
      </div>
    </div>
  </div>
</template>
