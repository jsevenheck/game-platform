import { randomInt } from 'node:crypto';

const MAX_NAME_LENGTH = 32;

export function sanitizeName(name: unknown): string {
  if (typeof name !== 'string') return '';
  return name.trim().slice(0, MAX_NAME_LENGTH);
}

export function getRandomInt(maxExclusive: number): number {
  if (maxExclusive <= 1) {
    return 0;
  }

  return randomInt(maxExclusive);
}

export function shuffle<T>(arr: T[]): T[] {
  const array = [...arr];
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = getRandomInt(i + 1);
    [array[i], array[j]] = [array[j]!, array[i]!];
  }
  return array;
}
