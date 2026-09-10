<script setup lang="ts">
import type { RoomView } from '@shared/types';
const props = defineProps<{ room: RoomView }>();
</script>
<template>
  <div class="ui-panel mt-4" data-testid="herd-mentality-scoreboard" aria-live="polite">
    <h3 class="font-semibold">Punktestand</h3>
    <ul class="mt-2 space-y-1">
      <li
        v-for="score in props.room.scores"
        :key="score.playerId"
        class="flex flex-wrap justify-between gap-2"
      >
        <span
          >{{ score.name
          }}<span v-if="score.hasPinkCow" class="ml-2 text-warning">Pink Cow</span></span
        ><span>{{ score.cows }} Kühe</span>
      </li>
    </ul>
  </div>
</template>
