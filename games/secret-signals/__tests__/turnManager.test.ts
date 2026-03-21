import { getActiveTeamColors } from '../core/src/constants';
import type { AssassinPenaltyMode, Room } from '../core/src/types';
import { generateBoard } from '../server/src/managers/boardManager';
import {
  advanceToNextTeam,
  checkWinCondition,
  giveSignal,
  processGuess,
} from '../server/src/managers/turnManager';

function makePlayingRoom(options?: {
  teamCount?: number;
  assassinPenaltyMode?: AssassinPenaltyMode;
}): Room {
  const teamCount = options?.teamCount ?? 2;
  const turnOrder = getActiveTeamColors(teamCount);
  const { board, teams } = generateBoard(teamCount, turnOrder);
  return {
    code: 'TEST',
    hostId: 'p1',
    phase: 'playing',
    players: {},
    board,
    teams,
    currentTurnTeam: turnOrder[0],
    turnPhase: 'giving-signal',
    currentSignal: null,
    turnOrder,
    log: [],
    winnerTeam: null,
    winningTeams: [],
    teamCount,
    assassinPenaltyMode: options?.assassinPenaltyMode ?? 'elimination',
    focusedCards: [],
    nextStartingTeamIndex: 0,
  };
}

function findCardIndex(room: Room, type: string): number {
  return room.board.findIndex((card) => card.type === type && !card.revealed);
}

describe('turnManager', () => {
  test('giveSignal sets signal and changes turn phase', () => {
    const room = makePlayingRoom();
    room.focusedCards = [{ cardIndex: 8, playerId: 'p2' }];
    giveSignal(room, 'CLUE', 2);
    expect(room.currentSignal).not.toBeNull();
    expect(room.currentSignal!.word).toBe('CLUE');
    expect(room.currentSignal!.number).toBe(2);
    expect(room.currentSignal!.teamColor).toBe('red');
    expect(room.currentSignal!.guessesUsed).toBe(0);
    expect(room.turnPhase).toBe('guessing');
    expect(room.focusedCards).toHaveLength(0);
  });

  test('processGuess correct team card does not end turn', () => {
    const room = makePlayingRoom();
    giveSignal(room, 'CLUE', 3);
    const idx = findCardIndex(room, 'red');
    room.focusedCards = [
      { cardIndex: idx, playerId: 'p2' },
      { cardIndex: 12, playerId: 'p2' },
      { cardIndex: 14, playerId: 'p3' },
    ];
    const result = processGuess(room, idx, 'red');
    expect(result.outcome).toBe('correct');
    expect(result.turnEnds).toBe(false);
    expect(room.board[idx].revealed).toBe(true);
    expect(room.focusedCards).toEqual([
      { cardIndex: 12, playerId: 'p2' },
      { cardIndex: 14, playerId: 'p3' },
    ]);
  });

  test('processGuess neutral card ends turn', () => {
    const room = makePlayingRoom();
    giveSignal(room, 'CLUE', 2);
    const idx = findCardIndex(room, 'neutral');
    const result = processGuess(room, idx, 'red');
    expect(result.outcome).toBe('neutral');
    expect(result.turnEnds).toBe(true);
  });

  test('processGuess wrong team card ends turn', () => {
    const room = makePlayingRoom();
    giveSignal(room, 'CLUE', 2);
    const idx = findCardIndex(room, 'blue');
    const result = processGuess(room, idx, 'red');
    expect(result.outcome).toBe('wrong-team');
    expect(result.turnEnds).toBe(true);
  });

  test('processGuess assassin eliminates team in elimination mode', () => {
    const room = makePlayingRoom({ assassinPenaltyMode: 'elimination' });
    giveSignal(room, 'CLUE', 2);
    const idx = findCardIndex(room, 'assassin');
    const result = processGuess(room, idx, 'red');
    expect(result.outcome).toBe('assassin');
    expect(result.teamEliminated).toBe(true);
    expect(result.gameOver).toBe(true);
    expect(result.winners).toEqual(['blue']);
  });

  test('processGuess assassin ends the match for all surviving teams in instant-loss mode', () => {
    const room = makePlayingRoom({ teamCount: 3, assassinPenaltyMode: 'instant-loss' });
    giveSignal(room, 'CLUE', 2);
    const idx = findCardIndex(room, 'assassin');
    const result = processGuess(room, idx, 'red');
    expect(result.outcome).toBe('assassin');
    expect(result.teamEliminated).toBe(true);
    expect(result.gameOver).toBe(true);
    expect(result.winners).toEqual(['blue', 'green']);
  });

  test('guess limit: number+1 guesses then turn ends', () => {
    const room = makePlayingRoom();
    giveSignal(room, 'CLUE', 1);

    let idx = findCardIndex(room, 'red');
    let result = processGuess(room, idx, 'red');
    expect(result.outcome).toBe('correct');
    expect(result.turnEnds).toBe(false);

    idx = findCardIndex(room, 'red');
    result = processGuess(room, idx, 'red');
    expect(result.outcome).toBe('correct');
    expect(result.turnEnds).toBe(true);
  });

  test('signal number 0 means unlimited guesses', () => {
    const room = makePlayingRoom();
    giveSignal(room, 'CLUE', 0);

    for (let i = 0; i < 5; i++) {
      const idx = findCardIndex(room, 'red');
      if (idx === -1) break;
      const result = processGuess(room, idx, 'red');
      if (result.gameOver) break;
      expect(result.turnEnds).toBe(false);
    }
  });

  test('advanceToNextTeam moves to next team', () => {
    const room = makePlayingRoom();
    giveSignal(room, 'CLUE', 1);
    room.focusedCards = [{ cardIndex: 4, playerId: 'p9' }];
    advanceToNextTeam(room);
    expect(room.currentTurnTeam).toBe('blue');
    expect(room.turnPhase).toBe('giving-signal');
    expect(room.currentSignal).toBeNull();
    expect(room.focusedCards).toHaveLength(0);
  });

  test('advanceToNextTeam skips eliminated teams', () => {
    const room = makePlayingRoom();
    room.teams[1].eliminated = true;
    advanceToNextTeam(room);
    expect(room.currentTurnTeam).toBe('red');
  });

  test('checkWinCondition: team found all cards wins', () => {
    const room = makePlayingRoom();
    const redTeam = room.teams.find((team) => team.color === 'red')!;
    redTeam.revealedCount = redTeam.targetCount;
    expect(checkWinCondition(room)).toEqual(['red']);
  });

  test('checkWinCondition: last standing team wins', () => {
    const room = makePlayingRoom();
    room.teams[0].eliminated = true;
    expect(checkWinCondition(room)).toEqual(['blue']);
  });

  test('checkWinCondition: no winner yet', () => {
    const room = makePlayingRoom();
    expect(checkWinCondition(room)).toBeNull();
  });
});
