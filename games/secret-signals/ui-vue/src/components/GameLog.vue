<script setup lang="ts">
import { computed } from 'vue';
import { TEAM_HEX_BY_COLOR } from '@shared/constants';
import { useGameStore } from '../stores/game';
import { CARD_HEX_BY_TYPE } from '../lib/teamTheme';

const store = useGameStore();
const reversedLog = computed(() => [...(store.room?.log ?? [])].reverse());
</script>

<template>
  <div class="bg-shell border-l border-border p-4 overflow-y-auto max-h-full">
    <h3 class="text-muted text-xs uppercase tracking-[0.1em] mb-3">Signal Log</h3>
    <div v-if="reversedLog.length === 0" class="text-muted-foreground/60 text-xs italic">No signals yet</div>
    <div class="flex flex-col gap-3">
      <div v-for="(entry, i) in reversedLog" :key="i" class="p-2 bg-elevated rounded-[--radius-sm]">
        <div class="flex items-center gap-1.5 mb-1">
          <span class="w-2 h-2 rounded-full shrink-0" :style="{ backgroundColor: TEAM_HEX_BY_COLOR[entry.teamColor] }" />
          <span class="text-foreground font-semibold text-sm uppercase">{{ entry.signal.word }}</span>
          <span class="text-signals font-bold text-sm">{{ entry.signal.number }}</span>
        </div>
        <div class="flex flex-wrap gap-x-2 gap-y-1">
          <span
            v-for="(card, j) in entry.revealedCards"
            :key="j"
            class="text-xs font-medium"
            :style="{ color: CARD_HEX_BY_TYPE[card.type] }"
          >
            {{ card.word }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>
