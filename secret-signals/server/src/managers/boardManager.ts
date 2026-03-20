import { BOARD_SIZE, getCardDistribution } from '../../../core/src/constants';
import type { Card, CardType, TeamColor, TeamConfig } from '../../../core/src/types';
import { WORD_LIST } from '../data/words';
import { shuffle } from '../utils/helpers';

export function generateBoard(
  teamCount: number,
  turnOrder: TeamColor[]
): { board: Card[]; teams: TeamConfig[] } {
  const words = shuffle([...WORD_LIST]).slice(0, BOARD_SIZE);
  const dist = getCardDistribution(teamCount);

  const types: CardType[] = [];

  for (let i = 0; i < teamCount; i++) {
    const color = turnOrder[i];
    for (let j = 0; j < dist.perTeam[i]; j++) {
      types.push(color);
    }
  }

  types.push('assassin');

  for (let i = 0; i < dist.neutral; i++) {
    types.push('neutral');
  }

  const shuffledTypes = shuffle(types);

  const board: Card[] = words.map((word, index) => ({
    word,
    type: shuffledTypes[index],
    revealed: false,
    revealedBy: null,
  }));

  const teams: TeamConfig[] = turnOrder.map((color, index) => ({
    color,
    targetCount: dist.perTeam[index],
    revealedCount: 0,
    eliminated: false,
  }));

  return { board, teams };
}
