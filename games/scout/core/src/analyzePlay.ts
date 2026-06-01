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

  if (count === 1) {
    return { kind: 'single', strength: values[0], count, highCard };
  }

  const isSet = values.every((value) => value === values[0]);
  if (isSet) {
    return { kind: 'set', strength: values[0] * count, count, highCard };
  }

  const sameColor = cards.every((card) => cardColor(card) === cardColor(cards[0]));
  const sortedValues = [...values].sort((a, b) => a - b);
  const isRun = sortedValues.every(
    (value, index) => index === 0 || value === sortedValues[index - 1] + 1
  );
  if (isRun && sameColor) {
    return { kind: 'run', strength: highCard * count, count, highCard };
  }

  throw new Error('Play must be a valid set or run');
}

export function comparePlayAnalyses(candidate: PlayAnalysis, current: PlayAnalysis): number {
  if (candidate.strength !== current.strength) {
    return candidate.strength - current.strength;
  }
  return candidate.highCard - current.highCard;
}
