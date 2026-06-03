import { describe, expect, it } from 'vitest';
import { analyzePlay, comparePlayAnalyses } from '../core/src/analyzePlay';
import type { ScoutCard } from '../core/src/deck';

function card(id: string, playValue: number, scoutPoints = playValue): ScoutCard {
  return { id, kind: 'scout', playValue, scoutPoints, flipped: false };
}

describe('Scout play analysis', () => {
  it('scores runs by actual sum of card values', () => {
    const run = analyzePlay([card('r1', 3), card('r2', 4), card('r3', 5)]);

    expect(run.kind).toBe('run');
    expect(run.strength).toBe(12); // 3+4+5
    expect(run.count).toBe(3);
    expect(run.highCard).toBe(5);
  });

  it('scores sets by actual sum of card values', () => {
    const set = analyzePlay([card('s1', 7), card('s2', 7)]);

    expect(set.kind).toBe('set');
    expect(set.strength).toBe(14); // 7+7
    expect(set.count).toBe(2);
    expect(set.highCard).toBe(7);
  });

  it('more cards always beats fewer cards', () => {
    const run3 = analyzePlay([card('r1', 3), card('r2', 4), card('r3', 5)]);
    const set2 = analyzePlay([card('s1', 7), card('s2', 7)]);
    const single = analyzePlay([card('c1', 10)]);
    const pair = analyzePlay([card('p1', 5), card('p2', 5)]);

    // 3 cards beats 2 cards
    expect(comparePlayAnalyses(run3, set2)).toBeGreaterThan(0);
    // 2 cards beats 1 card
    expect(comparePlayAnalyses(pair, single)).toBeGreaterThan(0);
  });

  it('same count: higher highCard wins', () => {
    const highRun = analyzePlay([card('r1', 4), card('r2', 5)]);
    const lowRun = analyzePlay([card('r3', 2), card('r4', 3)]);
    const highSet = analyzePlay([card('s1', 6), card('s2', 6)]);
    const lowSet = analyzePlay([card('s3', 3), card('s4', 3)]);

    expect(comparePlayAnalyses(highRun, lowRun)).toBeGreaterThan(0);
    expect(comparePlayAnalyses(highSet, lowSet)).toBeGreaterThan(0);
    // run with high card 5 beats set with high card 3 (same count)
    expect(comparePlayAnalyses(highRun, lowSet)).toBeGreaterThan(0);
  });

  it('same count + same highCard: set beats run', () => {
    const run = analyzePlay([card('r1', 1), card('r2', 2)]); // high 2
    const set = analyzePlay([card('s1', 2), card('s2', 2)]); // high 2

    expect(comparePlayAnalyses(set, run)).toBeGreaterThan(0);
    expect(comparePlayAnalyses(run, set)).toBeLessThan(0);
  });
});
