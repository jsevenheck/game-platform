import { describe, expect, it } from 'vitest';
import { analyzePlay, comparePlayAnalyses } from '../core/src/analyzePlay';
import type { ScoutCard } from '../core/src/deck';

function card(id: string, playValue: number, scoutPoints = playValue): ScoutCard {
  return { id, kind: 'scout', playValue, scoutPoints, flipped: false };
}

describe('Scout play analysis', () => {
  it('scores runs by high card times count instead of raw sum', () => {
    const run = analyzePlay([card('r1', 3), card('r2', 4), card('r3', 5)]);

    expect(run.kind).toBe('run');
    expect(run.strength).toBe(15);
    expect(run.count).toBe(3);
    expect(run.highCard).toBe(5);
  });

  it('scores sets by set value times count', () => {
    const set = analyzePlay([card('s1', 7), card('s2', 7)]);

    expect(set.kind).toBe('set');
    expect(set.strength).toBe(14);
    expect(set.count).toBe(2);
    expect(set.highCard).toBe(7);
  });

  it('compares plays by shared strength and high-card rules', () => {
    const run = analyzePlay([card('r1', 3), card('r2', 4), card('r3', 5)]);
    const set = analyzePlay([card('s1', 7), card('s2', 7)]);
    const single = analyzePlay([card('c1', 10)]);
    const pair = analyzePlay([card('p1', 5), card('p2', 5)]);

    expect(comparePlayAnalyses(run, set)).toBeGreaterThan(0);
    expect(comparePlayAnalyses(pair, single)).toBeLessThan(0);
  });
});
