<script setup lang="ts">
import { computed } from 'vue';
import type { RoomView } from '@shared/types';

const props = defineProps<{
  room: RoomView;
  myId: string;
}>();

interface MarkerPosition {
  playerId: string;
  name: string;
  guess: number;
  isMine: boolean;
  x: number; // 0-1 normalized
  offsetY: number; // vertical stack offset to avoid overlap
}

const PADDING_FRACTION = 0.04;
const SOLUTION_COLOR = '#fbbf24';
const PLAYER_COLOR = '#0ea5e9';
const MY_PLAYER_COLOR = '#38bdf8';

const range = computed(() => {
  if (props.room.displayRange) {
    return { lo: props.room.displayRange.lo, hi: props.room.displayRange.hi };
  }
  return { lo: 0, hi: 1 };
});

const span = computed(() => Math.max(range.value.hi - range.value.lo, 1e-9));

function toX(value: number): number {
  const { lo } = range.value;
  const usable = 1 - PADDING_FRACTION * 2;
  return PADDING_FRACTION + ((value - lo) / span.value) * usable;
}

const playerMarkers = computed<MarkerPosition[]>(() => {
  const rows: MarkerPosition[] = [];
  const usedXs: number[] = [];
  for (const g of props.room.guesses) {
    const player = props.room.players.find((p) => p.id === g.playerId);
    if (!player) continue;
    let x = toX(g.guess);
    // Clamp to keep marker inside the visible band.
    if (x < 0.01) x = 0.01;
    if (x > 0.99) x = 0.99;
    // Stack vertically if the previous marker is at the same x.
    let offsetY = 0;
    for (const other of usedXs) {
      if (Math.abs(other - x) < 0.04) offsetY += 18;
    }
    usedXs.push(x);
    rows.push({
      playerId: player.id,
      name: player.name,
      guess: g.guess,
      isMine: player.id === props.myId,
      x,
      offsetY,
    });
  }
  return rows;
});

const solutionMarker = computed(() => {
  if (props.room.solution === null) return null;
  let x = toX(props.room.solution);
  if (x < 0.01) x = 0.01;
  if (x > 0.99) x = 0.99;
  return { x, value: props.room.solution };
});
</script>

<template>
  <div class="number-line" data-testid="estimate-number-line">
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      class="number-line-svg"
      role="img"
      aria-label="Number line of player guesses"
    >
      <line
        x1="0"
        :y1="50"
        x2="100"
        :y2="50"
        stroke="currentColor"
        stroke-width="0.6"
        opacity="0.4"
      />
    </svg>
    <div class="markers">
      <div
        v-for="m in playerMarkers"
        :key="m.playerId"
        class="marker player-marker"
        :class="{ mine: m.isMine }"
        :style="{
          left: m.x * 100 + '%',
          transform: `translate(-50%, calc(-100% - ${m.offsetY}px - 4px))`,
        }"
        :title="`${m.name}: ${m.guess}`"
      >
        <span class="marker-label">{{ m.name }}</span>
        <span class="marker-value">{{ m.guess }}</span>
      </div>
      <div
        v-if="solutionMarker"
        class="marker solution-marker"
        :style="{ left: solutionMarker.x * 100 + '%', transform: 'translate(-50%, -50%)' }"
        :title="`Lösung: ${solutionMarker.value}`"
      >
        <span class="marker-value">{{ solutionMarker.value }}</span>
      </div>
    </div>
    <div class="axis">
      <span>{{ range.lo.toFixed(2) }}</span>
      <span>{{ ((range.lo + range.hi) / 2).toFixed(2) }}</span>
      <span>{{ range.hi.toFixed(2) }}</span>
    </div>
  </div>
</template>

<style scoped>
.number-line {
  position: relative;
  width: 100%;
  height: 120px;
  padding: 32px 8px 24px;
}

.number-line-svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  color: var(--color-foreground, #fff);
}

.markers {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.marker {
  position: absolute;
  top: 50%;
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  font-size: 0.7rem;
  line-height: 1.1;
  padding: 0.15rem 0.35rem;
  border-radius: 0.25rem;
  pointer-events: auto;
}

.player-marker {
  background: v-bind(PLAYER_COLOR);
  color: #050509;
}

.player-marker.mine {
  background: v-bind(MY_PLAYER_COLOR);
  outline: 1.5px solid #fff;
}

.solution-marker {
  background: transparent;
  color: v-bind(SOLUTION_COLOR);
  border: 1.5px solid v-bind(SOLUTION_COLOR);
  font-weight: 600;
}

.marker-label {
  font-weight: 500;
  white-space: nowrap;
  max-width: 80px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.marker-value {
  font-size: 0.6rem;
  opacity: 0.85;
}

.axis {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  justify-content: space-between;
  font-size: 0.65rem;
  opacity: 0.5;
}
</style>
