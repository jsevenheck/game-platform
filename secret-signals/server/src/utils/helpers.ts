const MAX_NAME_LENGTH = 32;

export function sanitizeName(name: unknown): string {
  if (typeof name !== 'string') return '';
  return name.trim().slice(0, MAX_NAME_LENGTH);
}

export function shuffle<T>(arr: T[]): T[] {
  if (process.env.E2E_TESTS === '1') {
    return [...arr];
  }
  const array = [...arr];
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j]!, array[i]!];
  }
  return array;
}
