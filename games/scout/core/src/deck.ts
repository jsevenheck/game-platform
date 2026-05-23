import { CARD_VALUES, DECK_SIZE } from './constants';

export interface ScoutCard {
  id: string;
  kind: 'scout';
  playValue: number;
  scoutPoints: number;
  flipped: boolean;
}

/**
 * Builds a 45-card Scout deck using every distinct unordered pair from 1..10.
 * C(10, 2) = 45, giving every card two distinct values.
 */
export function buildDeck(): ScoutCard[] {
  const cards: ScoutCard[] = [];
  let index = 1;

  for (let i = 0; i < CARD_VALUES.length; i++) {
    for (let j = i + 1; j < CARD_VALUES.length; j++) {
      cards.push({
        id: `s${String(index).padStart(2, '0')}`,
        kind: 'scout',
        playValue: CARD_VALUES[i],
        scoutPoints: CARD_VALUES[j],
        flipped: false,
      });
      index++;
    }
  }

  if (cards.length !== DECK_SIZE) {
    throw new Error(`Invalid Scout deck size: ${cards.length}`);
  }

  return cards;
}

export function flipCard(card: ScoutCard): ScoutCard {
  return {
    ...card,
    playValue: card.scoutPoints,
    scoutPoints: card.playValue,
    flipped: !card.flipped,
  };
}
