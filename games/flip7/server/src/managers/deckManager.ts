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

/** Cards lying in front of players, including busted ones (official rule: leave them in place). */
function heldCards(round: RoundState): Card[] {
  const held: Card[] = [];
  for (const rp of Object.values(round.players)) {
    for (const value of rp.numberCards) {
      held.push({ kind: 'number', value: value as Extract<Card, { kind: 'number' }>['value'] });
    }
    for (const bonus of rp.modifierAdds) {
      held.push({
        kind: 'modifierAdd',
        bonus: bonus as Extract<Card, { kind: 'modifierAdd' }>['bonus'],
      });
    }
    if (rp.hasX2) held.push({ kind: 'modifierX2' });
    if (rp.hasSecondChance) held.push({ kind: 'action', action: 'secondChance' });
  }
  return held;
}

/**
 * Size of the physical discard pile. `round.discard` also lists the cards still lying in
 * front of players (bookkeeping for the 94-card total), which are not on the pile yet.
 */
export function discardPileSize(round: RoundState): number {
  return Math.max(0, round.discard.length - heldCards(round).length);
}

function sameCard(a: Card, b: Card): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'number' && b.kind === 'number') return a.value === b.value;
  if (a.kind === 'modifierAdd' && b.kind === 'modifierAdd') return a.bonus === b.bonus;
  if (a.kind === 'action' && b.kind === 'action') return a.action === b.action;
  return true;
}

/**
 * Shuffle the discard pile back into the deck. Cards still lying in front of
 * players stay out of the new deck (official rule) — they remain in `discard`
 * bookkeeping so the 94-card total is preserved.
 */
export function reshuffleFromDiscard(round: RoundState): void {
  const pool = round.discard.splice(0);
  const keep: Card[] = [];
  for (const held of heldCards(round)) {
    const index = pool.findIndex((card) => sameCard(card, held));
    if (index >= 0) keep.push(...pool.splice(index, 1));
  }
  round.discard.push(...keep);
  round.deck = shuffle(pool);
}
