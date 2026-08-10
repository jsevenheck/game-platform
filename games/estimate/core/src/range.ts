import { MIN_DISPLAY_SPAN } from './constants';
import type { DisplayRange } from './types';

/**
 * Computes the visible number-line range from the players' guesses and
 * (optionally) the revealed solution. Shared between server and client so
 * they never disagree about where markers should land.
 *
 * Rules (matches the user-facing plan in §1 of ESTIMATE_GAME_PLAN.md):
 *   - lo = min(guesses) - 10% * span
 *   - hi = max(guesses) + 10% * span
 *   - if all guesses are equal, fall back to (guess - 1, guess + 1)
 *     and extend to include the solution if present
 *   - if solution is given, the returned range always includes it
 */
export function computeDisplayRange(
  guesses: readonly number[],
  solution: number | null = null
): DisplayRange {
  if (guesses.length === 0 && solution === null) {
    return { lo: 0, hi: MIN_DISPLAY_SPAN };
  }

  if (guesses.length === 0 && solution !== null) {
    return {
      lo: solution - MIN_DISPLAY_SPAN / 2,
      hi: solution + MIN_DISPLAY_SPAN / 2,
    };
  }

  const minGuess = Math.min(...guesses);
  const maxGuess = Math.max(...guesses);
  const guessSpan = maxGuess - minGuess;
  const padding = guessSpan > 0 ? guessSpan * 0.1 : MIN_DISPLAY_SPAN / 2;

  let lo = minGuess - padding;
  let hi = maxGuess + padding;

  if (solution !== null) {
    lo = Math.min(lo, solution);
    hi = Math.max(hi, solution);
  }

  return { lo, hi };
}
