import { calculatePlayerRoundScore } from '../server/src/managers/scoreManager';
import type { RoundPlayer } from '../core/src/types';
import { FLIP7_BONUS } from '../core/src/constants';

function makeRoundPlayer(overrides: Partial<RoundPlayer> = {}): RoundPlayer {
  return {
    playerId: 'p1',
    status: 'active',
    numberCards: [],
    modifierAdds: [],
    hasX2: false,
    hasSecondChance: false,
    flipThreeRemaining: 0,
    ...overrides,
  };
}

describe('calculatePlayerRoundScore', () => {
  it('returns 0 for a busted player regardless of cards', () => {
    const rp = makeRoundPlayer({
      status: 'busted',
      numberCards: [5, 7, 3],
      hasX2: true,
      modifierAdds: [10],
    });
    expect(calculatePlayerRoundScore(rp, false)).toBe(0);
  });

  it('returns 0 for busted even with flip7 flag', () => {
    const rp = makeRoundPlayer({ status: 'busted', numberCards: [1, 2, 3, 4, 5, 6, 7] });
    expect(calculatePlayerRoundScore(rp, true)).toBe(0);
  });

  it('sums number cards correctly', () => {
    const rp = makeRoundPlayer({ status: 'stayed', numberCards: [3, 5, 2] });
    expect(calculatePlayerRoundScore(rp, false)).toBe(10);
  });

  it('doubles number sum with x2 modifier (not flats)', () => {
    const rp = makeRoundPlayer({
      status: 'stayed',
      numberCards: [3, 5],
      hasX2: true,
      modifierAdds: [6],
    });
    // numbers = (3+5)*2 = 16; flats = 6; total = 22
    expect(calculatePlayerRoundScore(rp, false)).toBe(22);
  });

  it('adds flat modifiers without doubling them', () => {
    const rp = makeRoundPlayer({ status: 'stayed', numberCards: [4], modifierAdds: [2, 8] });
    expect(calculatePlayerRoundScore(rp, false)).toBe(4 + 2 + 8);
  });

  it('adds Flip 7 bonus only to the triggerer', () => {
    const rp = makeRoundPlayer({ status: 'stayed', numberCards: [1, 2, 3, 4, 5, 6, 0] });
    const withBonus = calculatePlayerRoundScore(rp, true);
    const withoutBonus = calculatePlayerRoundScore(rp, false);
    expect(withBonus - withoutBonus).toBe(FLIP7_BONUS);
  });

  it('does NOT double the Flip 7 bonus with x2', () => {
    const rp = makeRoundPlayer({ status: 'stayed', numberCards: [2], hasX2: true });
    // numbers = 2*2 = 4; bonus = 15; total = 19 (not 4 + 15*2 = 34)
    expect(calculatePlayerRoundScore(rp, true)).toBe(4 + FLIP7_BONUS);
  });

  it('counts 0 in number sum (adds 0 points)', () => {
    const rp = makeRoundPlayer({ status: 'stayed', numberCards: [0, 5] });
    expect(calculatePlayerRoundScore(rp, false)).toBe(5);
  });

  it('returns 0 for player with no cards who stayed', () => {
    const rp = makeRoundPlayer({ status: 'stayed' });
    expect(calculatePlayerRoundScore(rp, false)).toBe(0);
  });

  it('applies x2 only to number sum, combining with flats and bonus', () => {
    const rp = makeRoundPlayer({
      status: 'stayed',
      numberCards: [3, 4],
      hasX2: true,
      modifierAdds: [10],
    });
    // numbers = (3+4)*2 = 14; flats = 10; bonus = 15; total = 39
    expect(calculatePlayerRoundScore(rp, true)).toBe(39);
  });
});
