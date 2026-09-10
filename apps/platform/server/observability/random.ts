import { randomInt } from 'node:crypto';

/**
 * Cryptographically-secure random helpers for game logic.
 *
 * `Math.random()` is implemented in V8 with xorshift128+, which is not
 * cryptographically secure: its internal state can be recovered from observed
 * outputs, after which subsequent values are predictable. That matters here
 * because these draws decide **hidden information** — which player is the
 * Kritzelagent agent, which player is the Imposter infiltrator, the order of a
 * shuffled deck. Predicting them breaks the core secret the game is built on.
 *
 * These are deliberately in the shared platform layer rather than duplicated
 * per game: Imposter used `node:crypto` while seven other games used
 * `Math.random()` for the equivalent operations, and a single implementation
 * is what keeps that from drifting apart again.
 *
 * Not for invite codes or tokens — those use `nanoid`, which is also CSPRNG-backed.
 */

/** Random integer in `[0, maxExclusive)`. Returns 0 for a non-positive bound. */
export function getRandomInt(maxExclusive: number): number {
  if (!Number.isFinite(maxExclusive) || maxExclusive <= 1) {
    return 0;
  }
  return randomInt(Math.floor(maxExclusive));
}

/** Pick one element at random. Returns `undefined` for an empty array. */
export function randomItem<T>(items: readonly T[]): T | undefined {
  if (items.length === 0) return undefined;
  return items[getRandomInt(items.length)];
}

/** Return a new array with the elements shuffled (Fisher-Yates, CSPRNG-driven). */
export function shuffle<T>(items: readonly T[]): T[] {
  const array = [...items];
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = getRandomInt(i + 1);
    [array[i], array[j]] = [array[j]!, array[i]!];
  }
  return array;
}
