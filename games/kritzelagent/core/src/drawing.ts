import { MAX_COORDINATE, MAX_STROKE_POINTS } from './constants';
import type { StrokePoint } from './types';

function isPoint(value: unknown): value is StrokePoint {
  if (!value || typeof value !== 'object') return false;
  const point = value as { x?: unknown; y?: unknown };
  return (
    typeof point.x === 'number' &&
    typeof point.y === 'number' &&
    Number.isFinite(point.x) &&
    Number.isFinite(point.y) &&
    point.x >= 0 &&
    point.x <= MAX_COORDINATE &&
    point.y >= 0 &&
    point.y <= MAX_COORDINATE
  );
}

function roundCoordinate(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

function distanceToSegment(point: StrokePoint, start: StrokePoint, end: StrokePoint): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  const fraction =
    lengthSquared === 0
      ? 0
      : Math.max(
          0,
          Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared)
        );
  return (point.x - start.x - fraction * dx) ** 2 + (point.y - start.y - fraction * dy) ** 2;
}

/** Geometry-first simplification, also used to bound the local gesture buffer.
 * Validate every raw point before reduction; an omitted malformed point must
 * never become a valid gesture. Preserve endpoints and the largest excursions,
 * not event indices (which alias repeated closed paths and stationary tails).
 */
export function sampleStroke(points: StrokePoint[], limit: number): StrokePoint[] | null {
  if (!Array.isArray(points) || !Number.isInteger(limit) || limit < 2) return null;
  const canonical: StrokePoint[] = [];
  for (const value of points) {
    if (!isPoint(value)) return null;
    const point = { x: roundCoordinate(value.x), y: roundCoordinate(value.y) };
    const previous = canonical[canonical.length - 1];
    if (!previous || previous.x !== point.x || previous.y !== point.y) canonical.push(point);
  }
  if (canonical.length <= limit) return canonical;

  function segment(start: number, end: number) {
    let index = -1;
    let distance = 0;
    for (let i = start + 1; i < end; i += 1) {
      const candidate = distanceToSegment(canonical[i]!, canonical[start]!, canonical[end]!);
      if (candidate > distance) {
        distance = candidate;
        index = i;
      }
    }
    return { start, end, index, distance };
  }
  const kept = new Set([0, canonical.length - 1]);
  const segments = [segment(0, canonical.length - 1)];
  while (kept.size < limit) {
    let best = 0;
    for (let i = 1; i < segments.length; i += 1)
      if (segments[i]!.distance > segments[best]!.distance) best = i;
    const next = segments[best]!;
    if (next.index < 0) break;
    kept.add(next.index);
    segments.splice(best, 1, segment(next.start, next.index), segment(next.index, next.end));
  }
  return [...kept].sort((a, b) => a - b).map((index) => canonical[index]!);
}

/** Samples locally; strict server validation keeps its existing 80-point cap. */
export function prepareStrokeForSubmission(points: StrokePoint[]): StrokePoint[] | null {
  const sampled = sampleStroke(points, MAX_STROKE_POINTS);
  return normalizeStroke(sampled);
}

/** Validates and canonicalizes a client-provided one-contiguous stroke. */
export function normalizeStroke(input: unknown): StrokePoint[] | null {
  if (!Array.isArray(input) || input.length < 2 || input.length > MAX_STROKE_POINTS) {
    return null;
  }

  const normalized: StrokePoint[] = [];
  for (const value of input) {
    if (!isPoint(value)) return null;
    const point = {
      x: roundCoordinate(value.x),
      y: roundCoordinate(value.y),
    };
    const previous = normalized[normalized.length - 1];
    if (!previous || previous.x !== point.x || previous.y !== point.y) {
      normalized.push(point);
    }
  }

  return normalized.length >= 2 ? normalized : null;
}
