import type { RoundPlayer } from '../../../core/src/types';
import { FLIP7_BONUS } from '../../../core/src/constants';

/**
 * Calculate the points earned by a player in a single round.
 *
 * Formula: (sum of number cards × x2 multiplier) + flat modifiers + Flip 7 bonus
 *
 * Rules:
 *  - Busted players score 0 regardless of held cards.
 *  - x2 doubles the number-card sum only (not flats, not the Flip 7 bonus).
 *  - The Flip 7 bonus is only awarded to the player who triggered Flip 7.
 *  - The 0 card contributes 0 points but counted toward the 7 unique card target.
 */
export function calculatePlayerRoundScore(rp: RoundPlayer, isFlip7Winner: boolean): number {
  if (rp.status === 'busted') return 0;
  const numSum = rp.numberCards.reduce((a, b) => a + b, 0);
  const numbers = rp.hasX2 ? numSum * 2 : numSum;
  const flats = rp.modifierAdds.reduce((a, b) => a + b, 0);
  const bonus = isFlip7Winner ? FLIP7_BONUS : 0;
  return numbers + flats + bonus;
}
