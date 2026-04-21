import { DECK_MAX_NUMBER, MODIFIER_ADD_VALUES, ACTION_CARD_COUNT } from './constants';

export type NumberCard = {
  kind: 'number';
  value: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
};
export type ModifierAdd = { kind: 'modifierAdd'; bonus: 2 | 4 | 6 | 8 | 10 };
export type ModifierX2 = { kind: 'modifierX2' };
export type ActionCard = { kind: 'action'; action: 'freeze' | 'flipThree' | 'secondChance' };
export type Card = NumberCard | ModifierAdd | ModifierX2 | ActionCard;

/**
 * Builds the full 94-card Flip 7 deck:
 *  - Number cards 0–12: card N appears N times (0 appears once) → 79 cards
 *  - Modifier +2, +4, +6, +8, +10: 1 each → 5 cards
 *  - Modifier x2: 1 card
 *  - Action Freeze: 3 cards
 *  - Action Flip Three: 3 cards
 *  - Action Second Chance: 3 cards
 * Total: 79 + 5 + 1 + 9 = 94 cards
 */
export function buildDeck(): Card[] {
  const cards: Card[] = [];

  // Number cards: 0 appears once, N appears N times for N > 0
  for (let n = 0; n <= DECK_MAX_NUMBER; n++) {
    const count = n === 0 ? 1 : n;
    for (let i = 0; i < count; i++) {
      cards.push({ kind: 'number', value: n as NumberCard['value'] });
    }
  }

  // Modifier add cards
  for (const bonus of MODIFIER_ADD_VALUES) {
    cards.push({ kind: 'modifierAdd', bonus });
  }

  // Modifier x2 card
  cards.push({ kind: 'modifierX2' });

  // Action cards
  const actions: ActionCard['action'][] = ['freeze', 'flipThree', 'secondChance'];
  for (const action of actions) {
    for (let i = 0; i < ACTION_CARD_COUNT; i++) {
      cards.push({ kind: 'action', action });
    }
  }

  return cards;
}
