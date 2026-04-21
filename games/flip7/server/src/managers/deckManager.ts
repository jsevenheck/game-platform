import type { Card } from '../../../core/src/deck';
import type { RoundState } from '../../../core/src/types';

/** Fisher–Yates shuffle (mutates in place, returns the same array) */
export function shuffle(deck: Card[]): Card[] {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

/**
 * Draw the top card from the draw pile.
 * If the draw pile is empty, reshuffles the discard pile into it first.
 * Throws if both piles are exhausted (should not happen in practice).
 */
export function draw(round: RoundState): Card {
  if (round.deck.length === 0) {
    reshuffleFromDiscard(round);
  }
  const card = round.deck.pop();
  if (!card) throw new Error('Deck exhausted even after reshuffle');
  return card;
}

/**
 * Move all discard cards back into the deck and shuffle.
 * Cards currently held by players (in their RoundPlayer entries) are NOT touched.
 */
export function reshuffleFromDiscard(round: RoundState): void {
  round.deck = shuffle(round.discard.splice(0));
}
