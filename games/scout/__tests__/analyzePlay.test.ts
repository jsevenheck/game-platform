import { describe, expect, it } from 'vitest';
import { analyzePlay, comparePlayAnalyses } from '../core/src/analyzePlay';
import type { ScoutCard } from '../core/src/deck';

function card(id: string, playValue: number, scoutPoints = playValue): ScoutCard {
  return { id, kind: 'scout', playValue, scoutPoints, flipped: false };
}

describe('Scout play analysis', () => {
  it('accepts ordered ascending and descending runs', () => {
    const ascending = analyzePlay([card('r1', 3), card('r2', 4), card('r3', 5)]);
    const descending = analyzePlay([card('r4', 5), card('r5', 4), card('r6', 3)]);

    expect(ascending).toMatchObject({ kind: 'run', count: 3, lowCard: 3, highCard: 5 });
    expect(descending).toMatchObject({ kind: 'run', count: 3, lowCard: 3, highCard: 5 });
  });

  it('rejects sorted-but-not-ordered runs', () => {
    expect(() => analyzePlay([card('r1', 3), card('r2', 5), card('r3', 4)])).toThrow(
      /matching set|ordered consecutive run/
    );
  });

  it('accepts matching-number sets', () => {
    const set = analyzePlay([card('s1', 7), card('s2', 7)]);

    expect(set).toMatchObject({ kind: 'set', count: 2, lowCard: 7, highCard: 7 });
  });

  it('more cards always beats fewer cards', () => {
    const run3 = analyzePlay([card('r1', 3), card('r2', 4), card('r3', 5)]);
    const set2 = analyzePlay([card('s1', 7), card('s2', 7)]);
    const single = analyzePlay([card('c1', 10)]);
    const pair = analyzePlay([card('p1', 5), card('p2', 5)]);

    expect(comparePlayAnalyses(run3, set2)).toBeGreaterThan(0);
    expect(comparePlayAnalyses(pair, single)).toBeGreaterThan(0);
  });

  it('same count: matching-number set beats run before values are compared', () => {
    const lowSet = analyzePlay([card('s1', 2), card('s2', 2)]);
    const highRun = analyzePlay([card('r1', 9), card('r2', 10)]);

    expect(comparePlayAnalyses(lowSet, highRun)).toBeGreaterThan(0);
    expect(comparePlayAnalyses(highRun, lowSet)).toBeLessThan(0);
  });

  it('same count and kind: higher low card wins', () => {
    const highRun = analyzePlay([card('r1', 4), card('r2', 5)]);
    const lowRun = analyzePlay([card('r3', 2), card('r4', 3)]);
    const highSet = analyzePlay([card('s1', 6), card('s2', 6)]);
    const lowSet = analyzePlay([card('s3', 3), card('s4', 3)]);

    expect(comparePlayAnalyses(highRun, lowRun)).toBeGreaterThan(0);
    expect(comparePlayAnalyses(highSet, lowSet)).toBeGreaterThan(0);
  });
});
