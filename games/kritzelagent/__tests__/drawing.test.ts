import { describe, expect, it } from 'vitest';
import { MAX_STROKE_POINTS } from '@shared/constants';
import { normalizeStroke, prepareStrokeForSubmission } from '../core/src/drawing';

describe('prepareStrokeForSubmission', () => {
  it.each([81, 500, 4096])(
    'fits a %s-point gesture into the server limit with both endpoints',
    (length) => {
      const points = Array.from({ length }, (_, index) => ({ x: index / (length - 1), y: 0.5 }));
      const prepared = prepareStrokeForSubmission(points)!;
      expect(prepared).toHaveLength(MAX_STROKE_POINTS);
      expect(prepared[0]).toEqual(points[0]);
      expect(prepared.at(-1)).toEqual(points.at(-1));
      expect(normalizeStroke(prepared)).toEqual(prepared);
    }
  );

  it('does not submit stationary taps or movement below coordinate precision', () => {
    expect(
      prepareStrokeForSubmission([
        { x: 0.2, y: 0.2 },
        { x: 0.2, y: 0.2 },
      ])
    ).toBeNull();
    expect(
      prepareStrokeForSubmission([
        { x: 0.2, y: 0.2 },
        { x: 0.200001, y: 0.2 },
      ])
    ).toBeNull();
  });
});

describe('normalizeStroke', () => {
  it('keeps valid normalized points and rounds noisy coordinates', () => {
    expect(
      normalizeStroke([
        { x: 0, y: 0 },
        { x: 0.123456, y: 0.654321 },
        { x: 1, y: 1 },
      ])
    ).toEqual([
      { x: 0, y: 0 },
      { x: 0.1235, y: 0.6543 },
      { x: 1, y: 1 },
    ]);
  });

  it('removes consecutive duplicate points while preserving a stroke', () => {
    expect(
      normalizeStroke([
        { x: 0.2, y: 0.2 },
        { x: 0.2, y: 0.2 },
        { x: 0.8, y: 0.8 },
      ])
    ).toEqual([
      { x: 0.2, y: 0.2 },
      { x: 0.8, y: 0.8 },
    ]);
  });

  it('rejects malformed, out-of-range, too short, and oversized strokes', () => {
    expect(normalizeStroke(null)).toBeNull();
    expect(normalizeStroke([{ x: 0.2, y: 0.2 }])).toBeNull();
    expect(
      normalizeStroke([
        { x: -0.1, y: 0 },
        { x: 0.5, y: 0.5 },
      ])
    ).toBeNull();
    expect(
      normalizeStroke([
        { x: Number.NaN, y: 0 },
        { x: 0.5, y: 0.5 },
      ])
    ).toBeNull();
    expect(
      normalizeStroke(
        Array.from({ length: MAX_STROKE_POINTS + 1 }, (_, index) => ({
          x: index / MAX_STROKE_POINTS,
          y: 0.5,
        }))
      )
    ).toBeNull();
  });
});
