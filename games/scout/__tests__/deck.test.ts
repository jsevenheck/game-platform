import { describe, expect, it } from 'vitest';
import { buildDeck, flipCard } from '../core/src/deck';

describe('Scout deck', () => {
  it('builds 45 dual-value cards', () => {
    const deck = buildDeck();
    expect(deck).toHaveLength(45);
    expect(new Set(deck.map((card) => card.id)).size).toBe(45);
    expect(deck.every((card) => card.playValue !== card.scoutPoints)).toBe(true);
  });

  it('flips a card by swapping play and scout values', () => {
    const card = buildDeck()[0];
    const flipped = flipCard(card);
    expect(flipped.playValue).toBe(card.scoutPoints);
    expect(flipped.scoutPoints).toBe(card.playValue);
    expect(flipped.flipped).toBe(true);
  });
});
