<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { StrokePoint, StrokeView } from '@shared/types';

const props = defineProps<{ strokes: StrokeView[]; disabled: boolean }>();
const emit = defineEmits<{ stroke: [points: StrokePoint[]] }>();
const canvas = ref<HTMLCanvasElement | null>(null);
const drawing = ref<StrokePoint[]>([]);
let resizeObserver: ResizeObserver | undefined;

function coordinates(event: PointerEvent): StrokePoint {
  const element = canvas.value!;
  const bounds = element.getBoundingClientRect();
  return {
    x: Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)),
    y: Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height)),
  };
}

function drawStroke(
  context: CanvasRenderingContext2D,
  points: StrokePoint[],
  width: number,
  height: number,
  color: string
) {
  if (points.length < 2) return;
  context.beginPath();
  context.moveTo(points[0]!.x * width, points[0]!.y * height);
  for (const point of points.slice(1)) context.lineTo(point.x * width, point.y * height);
  context.strokeStyle = color;
  context.lineWidth = 3;
  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.stroke();
}

function redraw() {
  const element = canvas.value;
  if (!element) return;
  const bounds = element.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  element.width = Math.max(1, Math.round(bounds.width * ratio));
  element.height = Math.max(1, Math.round(bounds.height * ratio));
  const context = element.getContext('2d');
  if (!context) return;
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, bounds.width, bounds.height);
  for (const stroke of props.strokes)
    drawStroke(context, stroke.points, bounds.width, bounds.height, '#f97316');
  drawStroke(context, drawing.value, bounds.width, bounds.height, '#fbbf24');
}

function start(event: PointerEvent) {
  if (props.disabled || !canvas.value) return;
  canvas.value.setPointerCapture(event.pointerId);
  drawing.value = [coordinates(event)];
  redraw();
}

function move(event: PointerEvent) {
  if (drawing.value.length === 0) return;
  drawing.value.push(coordinates(event));
  redraw();
}

function finish(event: PointerEvent, canceled = false) {
  if (canceled || drawing.value.length < 2) {
    drawing.value = [];
    redraw();
    return;
  }
  if (canvas.value?.hasPointerCapture(event.pointerId))
    canvas.value.releasePointerCapture(event.pointerId);
  emit('stroke', drawing.value);
  drawing.value = [];
  redraw();
}

onMounted(() => {
  resizeObserver = new ResizeObserver(redraw);
  if (canvas.value) resizeObserver.observe(canvas.value);
  redraw();
});
watch(() => props.strokes, redraw, { deep: true });
onBeforeUnmount(() => resizeObserver?.disconnect());
</script>

<template>
  <canvas
    ref="canvas"
    class="kritzelagent-canvas"
    :class="{ 'kritzelagent-canvas--disabled': disabled }"
    role="img"
    aria-label="Gemeinsame Kritzel-Leinwand"
    @pointerdown="start"
    @pointermove="move"
    @pointerup="finish"
    @pointercancel="finish($event, true)"
  />
</template>

<style scoped>
.kritzelagent-canvas {
  display: block;
  width: 100%;
  min-height: 18rem;
  aspect-ratio: 4 / 3;
  touch-action: none;
  border: 2px solid var(--color-kritzelagent, #f97316);
  border-radius: var(--radius-lg, 0.75rem);
  background: var(--color-panel);
  cursor: crosshair;
}
.kritzelagent-canvas--disabled {
  cursor: not-allowed;
  opacity: 0.82;
}
</style>
