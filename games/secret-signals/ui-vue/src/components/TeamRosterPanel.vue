<script setup lang="ts">
import { computed } from 'vue';
import { TEAM_HEX_BY_COLOR, TEAM_NAME_BY_COLOR } from '@shared/constants';
import type { PlayerView, TeamColor } from '@shared/types';

const props = defineProps<{
  teamColor: TeamColor;
  players: PlayerView[];
  isCurrentTurn: boolean;
  eliminated: boolean;
}>();

const director = computed(() => props.players.find((player) => player.role === 'director') ?? null);
const agents = computed(() => props.players.filter((player) => player.role === 'agent'));
</script>

<template>
  <section
    class="min-w-[180px] px-3.5 py-3.5 border border-border rounded-[--radius-lg] bg-shell shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
    :class="{
      'shadow-[inset_0_1px_0_rgba(255,255,255,0.03),0_0_0_1px_rgba(6,182,212,0.25)]': isCurrentTurn,
      'opacity-55': eliminated,
    }"
  >
    <header class="mb-3 pb-2 border-b-[3px]" :style="{ borderColor: TEAM_HEX_BY_COLOR[teamColor] }">
      <div class="flex items-center justify-between gap-2">
        <h3 class="text-foreground/95 text-sm font-extrabold uppercase tracking-[0.08em]">{{ TEAM_NAME_BY_COLOR[teamColor] }} Team</h3>
        <span v-if="isCurrentTurn" class="ui-badge bg-signals text-white">Turn</span>
        <span v-else-if="eliminated" class="ui-badge bg-border-strong text-muted-foreground">Out</span>
      </div>
    </header>

    <div class="flex flex-col gap-1">
      <span class="text-muted-foreground text-[0.7rem] font-bold uppercase tracking-[0.08em]">Director</span>
      <span class="text-foreground/90 text-sm font-semibold" :class="{ 'text-muted-foreground italic': !director }">
        {{ director?.name ?? 'Unassigned' }}
      </span>
    </div>

    <div class="flex flex-col gap-1 mt-2.5">
      <span class="text-muted-foreground text-[0.7rem] font-bold uppercase tracking-[0.08em]">Agents</span>
      <ul class="flex flex-col gap-0.5 list-none">
        <li v-for="agent in agents" :key="agent.id" class="text-foreground/90 text-sm font-semibold">
          {{ agent.name }}
        </li>
        <li v-if="agents.length === 0" class="text-muted-foreground text-sm italic">No agents</li>
      </ul>
    </div>
  </section>
</template>
