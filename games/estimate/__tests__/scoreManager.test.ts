import { describe, expect, it } from 'vitest';
import { computeRoundWinners } from '../server/src/managers/scoreManager';
describe('computeRoundWinners', () => {
  it('returns no winners for an empty guess list', () => {
    expect(computeRoundWinners([], 1989)).toEqual([]);
  });

  it('returns the single guesser as winner when there is one player', () => {
    expect(computeRoundWinners([{ playerId: 'p1', guess: 1990 }], 1989)).toEqual(['p1']);
  });

  it('returns the guesser closest in absolute distance to the answer', () => {
    const guesses = [
      { playerId: 'p1', guess: 1990 }, // distance 1
      { playerId: 'p2', guess: 2010 }, // distance 21
      { playerId: 'p3', guess: 1900 }, // distance 89
    ];
    expect(computeRoundWinners(guesses, 1989)).toEqual(['p1']);
  });

  it('returns every tied player as a winner', () => {
    const guesses = [
      { playerId: 'p1', guess: 1987 }, // distance 2
      { playerId: 'p2', guess: 1991 }, // distance 2
      { playerId: 'p3', guess: 2010 }, // distance 21
    ];
    expect(new Set(computeRoundWinners(guesses, 1989))).toEqual(new Set(['p1', 'p2']));
  });

  it('treats mathematically symmetric decimal guesses as a tie', () => {
    const guesses = [
      { playerId: 'low', guess: 0.9 },
      { playerId: 'high', guess: 1.1 },
    ];

    expect(new Set(computeRoundWinners(guesses, 1))).toEqual(new Set(['low', 'high']));
  });

  it('handles negative and decimal answers', () => {
    const guesses = [
      { playerId: 'p1', guess: -77 }, // distance 1
      { playerId: 'p2', guess: -80 }, // distance 2
    ];
    expect(computeRoundWinners(guesses, -78)).toEqual(['p1']);
  });

  it('skips non-finite guesses (NaN / Infinity) when computing winners', () => {
    const guesses = [
      { playerId: 'p1', guess: Number.NaN },
      { playerId: 'p2', guess: Number.POSITIVE_INFINITY },
      { playerId: 'p3', guess: 100 },
    ];
    expect(computeRoundWinners(guesses, 110)).toEqual(['p3']);
  });

  it('returns no winners if every guess is non-finite', () => {
    const guesses = [
      { playerId: 'p1', guess: Number.NaN },
      { playerId: 'p2', guess: Number.POSITIVE_INFINITY },
    ];
    expect(computeRoundWinners(guesses, 50)).toEqual([]);
  });
});
