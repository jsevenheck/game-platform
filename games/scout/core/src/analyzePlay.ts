import type { ScoutCard } from './deck';

export type PlayKind = 'single' | 'set' | 'run';

export interface PlayAnalysis {
  kind: PlayKind;
  count: number;
  highCard: number;
  lowCard: number;
}

export function analyzePlay(cards: readonly ScoutCard[]): PlayAnalysis {
  const count = cards.length;
  if (count < 1) throw new Error('Play must contain at least one card');

  const values = cards.map((card) => card.playValue);
  const highCard = Math.max(...values);
  const lowCard = Math.min(...values);

  if (count === 1) {
    return { kind: 'single', count, highCard, lowCard };
  }

  const isSet = values.every((value) => value === values[0]);
  if (isSet) {
    return { kind: 'set', count, highCard, lowCard };
  }

  const ascendingRun = values.every(
    (value, index) => index === 0 || value === values[index - 1] + 1
  );
  const descendingRun = values.every(
    (value, index) => index === 0 || value === values[index - 1] - 1
  );
  if (ascendingRun || descendingRun) {
    return { kind: 'run', count, highCard, lowCard };
  }

  throw new Error('Play must be a matching set or an ordered consecutive run');
}

// Official Scout beat order:
// 1. More cards wins.
// 2. Same count: matching-number sets beat consecutive runs.
// 3. Same count + same kind: higher lowest number wins.
export function comparePlayAnalyses(candidate: PlayAnalysis, current: PlayAnalysis): number {
  if (candidate.count !== current.count) {
    return candidate.count - current.count;
  }

  if (candidate.kind !== current.kind) {
    const kindRank: Record<PlayKind, number> = { single: 1, run: 1, set: 2 };
    return kindRank[candidate.kind] - kindRank[current.kind];
  }

  return candidate.lowCard - current.lowCard;
}
