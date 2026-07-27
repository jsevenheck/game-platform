import type { GuessEntry } from '../../../core/src/types';

/**
 * Pure helper: returns the playerIds that have the smallest absolute
 * distance to `answer` among the provided guesses.
 *
 * Behaviour:
 *   - Empty guesses → empty winners list.
 *   - Ties are returned as multiple winners (each tied player gets +1).
 *   - Does not mutate the input array.
 */
export function computeRoundWinners(guesses: GuessEntry[], answer: number): string[] {
  if (guesses.length === 0) return [];

  let bestDistance = Infinity;
  const distances: { playerId: string; distance: number }[] = [];

  for (const { playerId, guess } of guesses) {
    if (!Number.isFinite(guess)) continue;
    const distance = Math.abs(guess - answer);
    distances.push({ playerId, distance });
    if (distance < bestDistance) bestDistance = distance;
  }

  if (!Number.isFinite(bestDistance)) return [];

  return distances.filter((d) => d.distance === bestDistance).map((d) => d.playerId);
}
