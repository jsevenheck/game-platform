<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import type { RoomView } from '@shared/types';
import { useI18n } from 'vue-i18n';
import { assignMarkerLanes, clampMarkerX } from '../utils/markerLayout';

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
  trueX: number;
  lane: number;
  isWinner: boolean;
}

/** Vertical layout is in rem so chips and ticks keep fitting when the text is enlarged. */
const LANE_HEIGHT_REM = 2.625;
const container = ref<HTMLElement | null>(null);
const containerWidth = ref(640);
let resizeObserver: ResizeObserver | undefined;

const { t, locale } = useI18n();
const numberFormatter = computed(
  () => new Intl.NumberFormat(locale.value, { maximumFractionDigits: 6 })
);

const TRACK_HEIGHT_REM = 0.875;
/** Keeps dots at the range ends fully inside the clipped chart. */
const EDGE_INSET_PX = 10;
/** A winner zone wider than this share of the track says nothing, so it is hidden. */
const MAX_ZONE_FRACTION = 0.3;
const TICK_EDGE_PX = 36;

const range = computed(() => props.room.displayRange ?? { lo: 0, hi: 2 });

const rangeSpan = computed(() => Math.max(range.value.hi - range.value.lo, Number.EPSILON));

function toRawFraction(value: number): number {
  return Math.min(1, Math.max(0, (value - range.value.lo) / rangeSpan.value));
}

function toFraction(value: number): number {
  const inset = Math.min(0.5, EDGE_INSET_PX / Math.max(containerWidth.value, 1));
  return inset + toRawFraction(value) * (1 - 2 * inset);
}

function toX(value: number): number {
  return clampMarkerX(toFraction(value), Math.max(containerWidth.value, 1));
}

const winnerIds = computed(() => new Set(props.room.winners.map((winner) => winner.playerId)));

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
    trueX: toFraction(guess.guess),
    lane: lanes[index] ?? index,
    isWinner: winnerIds.value.has(player.id),
  }));
});

const maxLane = computed(() => Math.max(0, ...playerMarkers.value.map((marker) => marker.lane)));
const lineY = computed(() => 4 + maxLane.value * LANE_HEIGHT_REM);
const chartHeight = computed(() => lineY.value + 5.25);
const solutionMarker = computed(() =>
  props.room.solution === null
    ? null
    : {
        x: toX(props.room.solution),
        trueX: toFraction(props.room.solution),
        value: props.room.solution,
      }
);
/** Zone around the solution that reaches the closest guess (like the target zone of a spectrum). */
const winnerZone = computed(() => {
  const solution = props.room.solution;
  if (solution === null) return null;
  const distances = props.room.guesses
    .filter((guess) => winnerIds.value.has(guess.playerId))
    .map((guess) => Math.abs(guess.guess - solution));
  if (distances.length === 0) return null;
  const reach = Math.max(...distances);
  const lo = Math.max(range.value.lo, solution - reach);
  const hi = Math.min(range.value.hi, solution + reach);
  if (toRawFraction(hi) - toRawFraction(lo) > MAX_ZONE_FRACTION) return null;
  return { left: toFraction(lo), width: toFraction(hi) - toFraction(lo) };
});

/** Round tick values (1/2/5 x 10^n) instead of arbitrary quarter points. */
const axisTicks = computed(() => {
  const { lo, hi } = range.value;
  // Fewer ticks on narrow screens so the labels never run into each other.
  const rawStep = rangeSpan.value / (containerWidth.value < 480 ? 2 : 4);
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const normalized = rawStep / magnitude;
  const step = (normalized < 1.5 ? 1 : normalized < 3 ? 2 : normalized < 7 ? 5 : 10) * magnitude;
  const ticks: { value: number; left: number; shift: number }[] = [];
  for (let i = Math.ceil(lo / step); i * step <= hi && ticks.length < 12; i++) {
    const value = Number((i * step).toPrecision(12)) + 0; // + 0 turns -0 into 0
    const left = toFraction(value);
    const px = left * containerWidth.value;
    const shift = px < TICK_EDGE_PX ? 0 : px > containerWidth.value - TICK_EDGE_PX ? -100 : -50;
    ticks.push({ value, left, shift });
  }
  return ticks;
});

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
    data-testid="estimate-number-line"
    aria-labelledby="estimate-number-line-title"
  >
    <figcaption id="estimate-number-line-title" class="number-line-title">
      {{ t('estimate.numberLine.title') }}
    </figcaption>

    <div class="visual-chart" :style="{ height: `${chartHeight}rem` }" aria-hidden="true">
      <div class="track" :style="{ top: `${lineY - TRACK_HEIGHT_REM / 2}rem` }" />
      <div
        v-if="winnerZone"
        class="winner-zone"
        :style="{
          top: `${lineY - 1}rem`,
          left: `${winnerZone.left * 100}%`,
          width: `${winnerZone.width * 100}%`,
        }"
      />
      <div
        v-if="solutionMarker"
        class="solution-line"
        :style="{ left: `${solutionMarker.trueX * 100}%`, height: `${lineY + 0.875}rem` }"
      />

      <template v-for="marker in playerMarkers" :key="marker.playerId">
        <div
          class="stem"
          :class="{ winner: marker.isWinner }"
          :style="{
            left: `${marker.trueX * 100}%`,
            top: `${lineY - marker.lane * LANE_HEIGHT_REM - 0.5}rem`,
            height: `${marker.lane * LANE_HEIGHT_REM + 0.5}rem`,
          }"
        />
        <div
          class="dot"
          :class="{ mine: marker.isMine, winner: marker.isWinner }"
          :style="{ left: `${marker.trueX * 100}%`, top: `${lineY}rem` }"
        />
        <div
          class="marker player-marker"
          :class="{ mine: marker.isMine, winner: marker.isWinner }"
          :style="{
            left: `${marker.x * 100}%`,
            top: `${lineY}rem`,
            transform: `translate(-50%, calc(-100% - ${marker.lane * LANE_HEIGHT_REM + 0.5}rem))`,
          }"
        >
          <span class="marker-label">{{ marker.name }}</span>
          <span class="marker-value">{{ numberFormatter.format(marker.guess) }}</span>
        </div>
      </template>

      <div
        v-if="solutionMarker"
        class="marker solution-marker"
        :style="{
          left: `${solutionMarker.x * 100}%`,
          top: `${lineY}rem`,
          transform: 'translate(-50%, 1.125rem)',
        }"
      >
        <span class="solution-label">{{ t('estimate.numberLine.solution') }}</span>
        <span class="marker-value">{{ numberFormatter.format(solutionMarker.value) }}</span>
      </div>

      <div class="axis" :style="{ top: `${lineY + 4.25}rem` }">
        <span
          v-for="tick in axisTicks"
          :key="tick.value"
          class="tick"
          :style="{
            left: `${tick.left * 100}%`,
            transform: `translateX(${tick.shift}%)`,
          }"
          >{{ numberFormatter.format(tick.value) }}</span
        >
      </div>
    </div>

    <div class="sr-table-wrapper">
      <table>
        <caption>
          {{
            t('estimate.numberLine.tableCaption')
          }}
        </caption>
        <thead>
          <tr>
            <th scope="col">{{ t('estimate.numberLine.player') }}</th>
            <th scope="col">{{ t('estimate.numberLine.guess') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="marker in playerMarkers" :key="`table-${marker.playerId}`">
            <th scope="row">
              {{ marker.name }}{{ marker.isMine ? ` ${t('estimate.numberLine.you')}` : '' }}
            </th>
            <td>{{ numberFormatter.format(marker.guess) }}</td>
          </tr>
          <tr v-if="solutionMarker">
            <th scope="row">{{ t('estimate.numberLine.solution') }}</th>
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
  margin: 0;
}

.number-line-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-muted-foreground);
}

.visual-chart {
  position: relative;
  overflow: clip;
  margin-top: 0.5rem;
}

.track {
  position: absolute;
  left: 0;
  right: 0;
  height: 0.875rem;
  border-radius: 999px;
  background: linear-gradient(90deg, #8b5cf6, #38bdf8);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.08);
}

.winner-zone {
  position: absolute;
  z-index: 1;
  min-width: 8px;
  height: 2rem;
  box-sizing: border-box;
  border: 2px solid var(--color-success, #22c55e);
  border-radius: 0.5rem;
  background: rgba(34, 197, 94, 0.22);
}

.solution-line {
  position: absolute;
  z-index: 1;
  top: 0;
  width: 3px;
  margin-left: -1.5px;
  border-radius: 2px;
  background: #fbbf24;
  box-shadow: 0 0 10px rgba(251, 191, 36, 0.7);
}

.stem {
  position: absolute;
  width: 2px;
  margin-left: -1px;
  background: rgba(125, 211, 252, 0.55);
}

.stem.winner {
  background: rgba(74, 222, 128, 0.7);
}

.dot {
  position: absolute;
  z-index: 2;
  width: 16px;
  height: 16px;
  box-sizing: border-box;
  border: 3px solid #050509;
  border-radius: 50%;
  background: #7dd3fc;
  transform: translate(-50%, -50%);
}

.dot.winner {
  background: #4ade80;
}

.dot.mine {
  box-shadow: 0 0 0 2px #fff;
}

.marker {
  position: absolute;
  z-index: 3;
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

.player-marker.winner {
  background: #4ade80;
}

.player-marker.mine {
  background: #7dd3fc;
  outline: 2px solid #fff;
  outline-offset: 1px;
}

.player-marker.mine.winner {
  background: #4ade80;
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
  left: 0;
  right: 0;
  height: 1rem;
  color: var(--color-muted-foreground);
  font-size: 0.75rem;
  font-variant-numeric: tabular-nums;
}

.tick {
  position: absolute;
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
