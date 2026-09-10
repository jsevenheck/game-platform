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
    const previous = normalized.at(-1);
    if (!previous || previous.x !== point.x || previous.y !== point.y) {
      normalized.push(point);
    }
  }

  return normalized.length >= 2 ? normalized : null;
}
