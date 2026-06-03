import type { ScoutCard } from './deck';

export type PlayKind = 'single' | 'set' | 'run';

export interface PlayAnalysis {
  kind: PlayKind;
  strength: number;
  count: number;
  highCard: number;
}

function cardColor(card: ScoutCard): string {
  if ('color' in card && typeof card.color === 'string') return card.color;
  return card.flipped ? 'flipped' : 'base';
}

export function analyzePlay(cards: readonly ScoutCard[]): PlayAnalysis {
  const count = cards.length;
  if (count < 1) throw new Error('Play must be a valid set or run');

  const values = cards.map((card) => card.playValue);
  const highCard = Math.max(...values);
  const strength = values.reduce((sum, v) => sum + v, 0);

  if (count === 1) {
    return { kind: 'single', strength, count, highCard };
  }

  const isSet = values.every((value) => value === values[0]);
  if (isSet) {
    return { kind: 'set', strength, count, highCard };
  }

  const sameColor = cards.every((card) => cardColor(card) === cardColor(cards[0]));
  const sortedValues = [...values].sort((a, b) => a - b);
  const isRun = sortedValues.every(
    (value, index) => index === 0 || value === sortedValues[index - 1] + 1
  );
  if (isRun && sameColor) {
    return { kind: 'run', strength, count, highCard };
  }

  throw new Error('Play must be a valid set or run');
}

// Official Scout beat order:
// 1. More cards wins
// 2. Same count → higher highCard wins
// 3. Same count + same highCard → set beats run
export function comparePlayAnalyses(candidate: PlayAnalysis, current: PlayAnalysis): number {
  if (candidate.count !== current.count) {
    return candidate.count - current.count;
  }
  if (candidate.highCard !== current.highCard) {
    return candidate.highCard - current.highCard;
  }
  const kindRank: Record<PlayKind, number> = { single: 0, run: 1, set: 2 };
  return kindRank[candidate.kind] - kindRank[current.kind];
}
