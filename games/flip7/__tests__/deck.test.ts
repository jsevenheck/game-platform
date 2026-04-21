import { buildDeck } from '../core/src/deck';
import type { Card } from '../core/src/deck';

describe('buildDeck', () => {
  let deck: Card[];

  beforeEach(() => {
    deck = buildDeck();
  });

  it('contains exactly 94 cards', () => {
    expect(deck).toHaveLength(94);
  });

  it('contains one 0 card', () => {
    const zeros = deck.filter((c) => c.kind === 'number' && c.value === 0);
    expect(zeros).toHaveLength(1);
  });

  it('contains N copies of each number N (1–12)', () => {
    for (let n = 1; n <= 12; n++) {
      const count = deck.filter((c) => c.kind === 'number' && c.value === n).length;
      expect(count, `number ${n}`).toBe(n);
    }
  });

  it('contains 79 number cards total', () => {
    // 1 + (1+2+3+...+12) = 1 + 78 = 79
    const numCards = deck.filter((c) => c.kind === 'number');
    expect(numCards).toHaveLength(79);
  });

  it('contains each +2/+4/+6/+8/+10 modifier once', () => {
    for (const bonus of [2, 4, 6, 8, 10] as const) {
      const count = deck.filter((c) => c.kind === 'modifierAdd' && c.bonus === bonus).length;
      expect(count, `modifierAdd +${bonus}`).toBe(1);
    }
  });

  it('contains exactly one x2 card', () => {
    const x2 = deck.filter((c) => c.kind === 'modifierX2');
    expect(x2).toHaveLength(1);
  });

  it('contains 3 freeze cards', () => {
    const cards = deck.filter((c) => c.kind === 'action' && c.action === 'freeze');
    expect(cards).toHaveLength(3);
  });

  it('contains 3 flipThree cards', () => {
    const cards = deck.filter((c) => c.kind === 'action' && c.action === 'flipThree');
    expect(cards).toHaveLength(3);
  });

  it('contains 3 secondChance cards', () => {
    const cards = deck.filter((c) => c.kind === 'action' && c.action === 'secondChance');
    expect(cards).toHaveLength(3);
  });
});
