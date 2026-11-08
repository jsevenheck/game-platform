import { describe, expect, it } from 'vitest';
import { MAX_STROKE_POINTS } from '@shared/constants';
import { normalizeStroke, prepareStrokeForSubmission, sampleStroke } from '../core/src/drawing';

describe('prepareStrokeForSubmission', () => {
  it.each([81, 500, 4096])(
    'fits a %s-point gesture into the server limit with both endpoints',
    (length) => {
      const points = Array.from({ length }, (_, index) => ({ x: index / (length - 1), y: 0.5 }));
      const prepared = prepareStrokeForSubmission(points)!;
      expect(prepared.length).toBeLessThanOrEqual(MAX_STROKE_POINTS);
      expect(prepared.length).toBeGreaterThanOrEqual(2);
      expect(prepared[0]).toEqual(points[0]);
      expect(prepared.at(-1)).toEqual(points.at(-1));
      expect(normalizeStroke(prepared)).toEqual(prepared);
    }
  );

  it.each([159, 8201])('preserves movement in %s alternating return-point events', (length) => {
    const a = { x: 0.1, y: 0.1 };
    const b = { x: 0.9, y: 0.9 };
    let points = Array.from({ length }, (_, index) => (index % 2 ? b : a));
    // Exercise the canvas's local compaction as well as wire reduction.
    if (points.length > 4096) points = sampleStroke(points, 2048)!;
    const prepared = prepareStrokeForSubmission(points)!;
    expect(prepared[0]).toEqual(a);
    expect(prepared.at(-1)).toEqual(a);
    expect(prepared).toContainEqual(b);
    expect(prepared.length).toBeLessThanOrEqual(MAX_STROKE_POINTS);
    expect(normalizeStroke(prepared)).toEqual(prepared);
  });

  it('retains a brief closed excursion followed by a stationary tail', () => {
    const a = { x: 0.1, y: 0.1 };
    const b = { x: 0.9, y: 0.9 };
    expect(prepareStrokeForSubmission([a, ...Array(10).fill(b), ...Array(1201).fill(a)])).toEqual([
      a,
      b,
      a,
    ]);
  });

  it.each([null, { x: NaN, y: 0 }, { x: Infinity, y: 0 }, { x: 2, y: 0 }, { x: '0.5', y: 0 }])(
    'rejects malformed points even at raw indices omitted by the old sampler: %s',
    (bad) => {
      const points = Array.from({ length: 500 }, (_, index) => ({ x: index / 499, y: 0.5 }));
      (points as unknown[])[1] = bad;
      expect(prepareStrokeForSubmission(points)).toBeNull();
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
