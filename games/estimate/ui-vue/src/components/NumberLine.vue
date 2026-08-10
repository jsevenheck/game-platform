<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import type { RoomView } from '@shared/types';
import { assignMarkerLanes, projectMarkerValue } from '../utils/markerLayout';

const props = defineProps<{
  room: RoomView;
  myId: string;
}>();

interface MarkerPosition {
  playerId: string;
  name: string;
  guess: number;
  isMine: boolean;
  x: number;
  lane: number;
}

const LANE_HEIGHT_PX = 42;
const container = ref<HTMLElement | null>(null);
const containerWidth = ref(640);
let resizeObserver: ResizeObserver | undefined;

const numberFormatter = new Intl.NumberFormat('de-DE', {
  maximumFractionDigits: 6,
});

const range = computed(() => props.room.displayRange ?? { lo: 0, hi: 2 });

function toX(value: number): number {
  return projectMarkerValue(
    value,
    range.value.lo,
    range.value.hi,
    Math.max(containerWidth.value, 1)
  );
}

const playerMarkers = computed<MarkerPosition[]>(() => {
  const entries = props.room.guesses
    .map((guess) => {
      const player = props.room.players.find((candidate) => candidate.id === guess.playerId);
      return player ? { guess, player, x: toX(guess.guess) } : null;
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
    .sort((a, b) => a.x - b.x);
  const lanes = assignMarkerLanes(
    entries.map((entry) => entry.x),
    containerWidth.value
  );

  return entries.map(({ guess, player, x }, index) => ({
    playerId: player.id,
    name: player.name,
    guess: guess.guess,
    isMine: player.id === props.myId,
    x,
    lane: lanes[index] ?? index,
  }));
});

const maxLane = computed(() => Math.max(0, ...playerMarkers.value.map((marker) => marker.lane)));
const lineY = computed(() => 64 + maxLane.value * LANE_HEIGHT_PX);
const chartHeight = computed(() => lineY.value + 92);
const solutionMarker = computed(() =>
  props.room.solution === null ? null : { x: toX(props.room.solution), value: props.room.solution }
);
const axisValues = computed(() => [
  range.value.lo,
  (range.value.lo + range.value.hi) / 2,
  range.value.hi,
]);

onMounted(() => {
  if (!container.value) return;
  containerWidth.value = container.value.clientWidth;
  resizeObserver = new ResizeObserver(([entry]) => {
    if (entry) containerWidth.value = entry.contentRect.width;
  });
  resizeObserver.observe(container.value);
});

onBeforeUnmount(() => resizeObserver?.disconnect());
</script>

<template>
  <figure
    ref="container"
    class="number-line"
    :style="{ height: `${chartHeight}px` }"
    data-testid="estimate-number-line"
    aria-labelledby="estimate-number-line-title"
  >
    <figcaption id="estimate-number-line-title" class="number-line-title">
      Vergleich der Schätzungen
    </figcaption>

    <div class="visual-chart" aria-hidden="true">
      <div class="axis-line" :style="{ top: `${lineY}px` }" />
      <div
        v-for="marker in playerMarkers"
        :key="marker.playerId"
        class="marker player-marker"
        :class="{ mine: marker.isMine }"
        :style="{
          left: `${marker.x * 100}%`,
          top: `${lineY}px`,
          transform: `translate(-50%, calc(-100% - ${marker.lane * LANE_HEIGHT_PX + 8}px))`,
        }"
      >
        <span class="marker-label">{{ marker.name }}</span>
        <span class="marker-value">{{ numberFormatter.format(marker.guess) }}</span>
      </div>

      <div
        v-if="solutionMarker"
        class="marker solution-marker"
        :style="{
          left: `${solutionMarker.x * 100}%`,
          top: `${lineY}px`,
          transform: 'translate(-50%, 10px)',
        }"
      >
        <span class="solution-label">Lösung</span>
        <span class="marker-value">{{ numberFormatter.format(solutionMarker.value) }}</span>
      </div>

      <div class="axis" :style="{ top: `${lineY + 52}px` }">
        <span v-for="value in axisValues" :key="value">{{ numberFormatter.format(value) }}</span>
      </div>
    </div>

    <div class="sr-table-wrapper">
      <table>
        <caption>
          Schätzungen und Lösung als Tabelle
        </caption>
        <thead>
          <tr>
            <th scope="col">Spieler</th>
            <th scope="col">Schätzung</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="marker in playerMarkers" :key="`table-${marker.playerId}`">
            <th scope="row">{{ marker.name }}{{ marker.isMine ? ' (du)' : '' }}</th>
            <td>{{ numberFormatter.format(marker.guess) }}</td>
          </tr>
          <tr v-if="solutionMarker">
            <th scope="row">Lösung</th>
            <td>{{ numberFormatter.format(solutionMarker.value) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </figure>
</template>

<style scoped>
.number-line {
  position: relative;
  width: 100%;
  min-height: 180px;
  margin: 0;
}

.number-line-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-muted-foreground);
}

.visual-chart {
  position: absolute;
  overflow: clip;
  inset: 1.75rem 0 0;
}

.axis-line {
  position: absolute;
  left: 0;
  right: 0;
  height: 2px;
  background: var(--color-border-strong, #8b8ba3);
}

.marker {
  position: absolute;
  z-index: 1;
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  box-sizing: border-box;
  overflow: hidden;
  max-width: min(104px, calc(100% - 8px));
  padding: 0.25rem 0.45rem;
  border-radius: 0.375rem;
  font-size: 0.75rem;
  line-height: 1.2;
  text-align: center;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.35);
}

.player-marker {
  color: #050509;
  background: #38bdf8;
}

.player-marker.mine {
  background: #7dd3fc;
  outline: 2px solid #fff;
  outline-offset: 1px;
}

.solution-marker {
  color: #fff7d6;
  background: #5c4300;
  border: 2px solid #fbbf24;
  font-weight: 700;
}

.marker-label,
.solution-label {
  overflow: hidden;
  width: 100%;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.marker-value {
  overflow: hidden;
  width: 100%;
  font-variant-numeric: tabular-nums;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.axis {
  position: absolute;
  min-width: 0;
  left: 0;
  right: 0;
  overflow: clip;
  display: flex;
  justify-content: space-between;
  gap: 0.5rem;
  color: var(--color-muted-foreground);
  font-size: 0.75rem;
  font-variant-numeric: tabular-nums;
}

.axis span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sr-table-wrapper {
  position: fixed;
  top: 0;
  left: 0;
  overflow: clip;
  contain: strict;
  width: 1px;
  height: 1px;
  padding: 0;
  border: 0;
  margin: -1px;
  clip: rect(0, 0, 0, 0);
  clip-path: inset(50%);
  transform: scale(0);
  white-space: nowrap;
}

.sr-table-wrapper table {
  width: 1px;
  min-width: 1px;
  max-width: 1px;
  table-layout: fixed;
}

@media (max-width: 480px) {
  .marker {
    max-width: min(88px, calc(100% - 8px));
    font-size: 0.6875rem;
  }

  .axis {
    font-size: 0.6875rem;
  }
}
</style>
