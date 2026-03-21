import { MAX_TEAMS, getActiveTeamColors } from '../core/src/constants';
import { generateBoard } from '../server/src/managers/boardManager';

describe('boardManager', () => {
  test('generates 25 cards for supported team counts', () => {
    for (let teamCount = 2; teamCount <= MAX_TEAMS; teamCount++) {
      const colors = getActiveTeamColors(teamCount);
      const { board, teams } = generateBoard(teamCount, colors);
      expect(board).toHaveLength(25);
      expect(teams).toHaveLength(teamCount);
    }
  });

  test('card distribution for 2 teams: 9 + 8 + 1 assassin + 7 neutral', () => {
    const { board } = generateBoard(2, ['red', 'blue']);
    const counts: Record<string, number> = {};
    for (const card of board) {
      counts[card.type] = (counts[card.type] ?? 0) + 1;
    }
    expect(counts['red']).toBe(9);
    expect(counts['blue']).toBe(8);
    expect(counts['assassin']).toBe(1);
    expect(counts['neutral']).toBe(7);
  });

  test('card distribution for 3 teams: 6 + 5 + 5 + 1 assassin + 8 neutral', () => {
    const { board } = generateBoard(3, ['red', 'blue', 'green']);
    const counts: Record<string, number> = {};
    for (const card of board) {
      counts[card.type] = (counts[card.type] ?? 0) + 1;
    }
    expect(counts['red']).toBe(6);
    expect(counts['blue']).toBe(5);
    expect(counts['green']).toBe(5);
    expect(counts['assassin']).toBe(1);
    expect(counts['neutral']).toBe(8);
  });

  test('card distribution for 5 teams keeps one extra card for the starter', () => {
    const { board } = generateBoard(5, ['red', 'blue', 'green', 'orange', 'purple']);
    const counts: Record<string, number> = {};
    for (const card of board) {
      counts[card.type] = (counts[card.type] ?? 0) + 1;
    }
    expect(counts['red']).toBe(5);
    expect(counts['blue']).toBe(4);
    expect(counts['green']).toBe(4);
    expect(counts['orange']).toBe(4);
    expect(counts['purple']).toBe(4);
    expect(counts['assassin']).toBe(1);
    expect(counts['neutral']).toBe(3);
  });

  test('all words are unique', () => {
    const { board } = generateBoard(2, ['red', 'blue']);
    const words = board.map((card) => card.word);
    expect(new Set(words).size).toBe(25);
  });

  test('all cards start unrevealed', () => {
    const { board } = generateBoard(2, ['red', 'blue']);
    for (const card of board) {
      expect(card.revealed).toBe(false);
      expect(card.revealedBy).toBeNull();
    }
  });

  test('team configs have correct target counts', () => {
    const { teams } = generateBoard(2, ['red', 'blue']);
    expect(teams[0].color).toBe('red');
    expect(teams[0].targetCount).toBe(9);
    expect(teams[1].color).toBe('blue');
    expect(teams[1].targetCount).toBe(8);
    for (const team of teams) {
      expect(team.revealedCount).toBe(0);
      expect(team.eliminated).toBe(false);
    }
  });
});
