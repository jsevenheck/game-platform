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

  const values: number[] = [...guesses];
  if (solution !== null) values.push(solution);

  const minV = Math.min(...values);
  const maxV = Math.max(...values);
  const span = Math.max(maxV - minV, MIN_DISPLAY_SPAN);
  const padding = span * 0.1;

  let lo = minV - padding;
  let hi = maxV + padding;

  // Always keep a minimum visible span and never invert lo/hi.
  if (hi - lo < MIN_DISPLAY_SPAN) {
    const mid = (lo + hi) / 2;
    lo = mid - MIN_DISPLAY_SPAN / 2;
    hi = mid + MIN_DISPLAY_SPAN / 2;
  }

  return { lo, hi };
}
