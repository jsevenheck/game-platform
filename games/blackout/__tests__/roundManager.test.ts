import type { Room } from '../core/src/types';

// Mock the categoryManager since it requires SQLite
jest.mock('../server/src/managers/categoryManager', () => ({
  getUnusedPrompt: jest.fn(() => ({
    category: { id: 1, name: 'An animal' },
    task: { id: 1, text: 'Starts with letter {letter}', requiresLetter: true },
    letter: 'A',
  })),
}));

import {
  startNewRound,
  revealCategory,
  rerollCurrentPrompt,
  selectWinner,
  finalizeRound,
  getNextReader,
  getRandomReader,
  isLastRound,
} from '../server/src/managers/roundManager';

const { getUnusedPrompt: mockedGetUnusedPrompt } = jest.requireMock(
  '../server/src/managers/categoryManager'
) as { getUnusedPrompt: jest.Mock };

function makeRoom(): Room {
  return {
    code: 'TEST',
    ownerId: 'p1',
    hostId: 'p1',
    phase: 'playing',
    players: {
      p1: {
        id: 'p1',
        name: 'Alice',
        resumeToken: 'tok1',
        score: 0,
        connected: true,
        isHost: true,
        socketId: 's1',
      },
      p2: {
        id: 'p2',
        name: 'Bob',
        resumeToken: 'tok2',
        score: 0,
        connected: true,
        isHost: false,
        socketId: 's2',
      },
      p3: {
        id: 'p3',
        name: 'Carol',
        resumeToken: 'tok3',
        score: 0,
        connected: true,
        isHost: false,
        socketId: 's3',
      },
    },
    language: 'de',
    excludedLetters: ['Q', 'X', 'Y'],
    maxRounds: 10,
    currentRound: null,
    roundHistory: [],
    usedCategoryLetterPairs: new Set(),
  };
}

describe('roundManager', () => {
  beforeEach(() => {
    mockedGetUnusedPrompt.mockReset();
    mockedGetUnusedPrompt.mockReturnValue({
      category: { id: 1, name: 'An animal' },
      task: { id: 1, text: 'Starts with letter {letter}', requiresLetter: true },
      letter: 'A',
    });
  });

  test('startNewRound creates a round with correct reader', () => {
    const room = makeRoom();
    startNewRound(room, 'p1');
    expect(room.currentRound).not.toBeNull();
    expect(room.currentRound!.readerId).toBe('p1');
    expect(room.currentRound!.revealed).toBe(false);
    expect(room.currentRound!.roundNumber).toBe(1);
  });

  test('revealCategory sets revealed', () => {
    const room = makeRoom();
    startNewRound(room, 'p1');
    revealCategory(room);
    expect(room.currentRound!.revealed).toBe(true);
  });

  test('rerollCurrentPrompt replaces prompt and keeps round metadata', () => {
    const room = makeRoom();
    mockedGetUnusedPrompt
      .mockReturnValueOnce({
        category: { id: 1, name: 'Animals' },
        task: { id: 1, text: 'Starts with letter {letter}', requiresLetter: true },
        letter: 'A',
      })
      .mockReturnValueOnce({
        category: { id: 2, name: 'Famous person' },
        task: { id: 2, text: 'Contains exactly one vowel', requiresLetter: false },
        letter: null,
      });

    startNewRound(room, 'p1');
    const beforeRoundNumber = room.currentRound!.roundNumber;
    const beforeReaderId = room.currentRound!.readerId;

    rerollCurrentPrompt(room);

    expect(room.currentRound!.roundNumber).toBe(beforeRoundNumber);
    expect(room.currentRound!.readerId).toBe(beforeReaderId);
    expect(room.currentRound!.category.name).toBe('Famous person');
    expect(room.currentRound!.task.text).toBe('Contains exactly one vowel');
    expect(room.currentRound!.letter).toBeNull();
    expect(room.currentRound!.revealed).toBe(false);
  });

  test('selectWinner stores winner id', () => {
    const room = makeRoom();
    startNewRound(room, 'p1');
    revealCategory(room);
    selectWinner(room, 'p2');
    expect(room.currentRound!.winnerId).toBe('p2');
  });

  test('finalizeRound adds to history', () => {
    const room = makeRoom();
    startNewRound(room, 'p1');
    revealCategory(room);
    selectWinner(room, 'p2');

    const result = finalizeRound(room);
    expect(result).not.toBeNull();
    expect(result!.winnerId).toBe('p2');
    expect(room.roundHistory.length).toBe(1);
  });

  test('getNextReader returns host as next reader', () => {
    const room = makeRoom();
    startNewRound(room, 'p1');
    revealCategory(room);
    selectWinner(room, 'p3');

    const next = getNextReader(room);
    expect(next).toBe('p1');
  });

  test('getNextReader falls back to first player when host is missing', () => {
    const room = makeRoom();
    room.hostId = null;
    startNewRound(room, 'p1');
    const next = getNextReader(room);
    expect(next).toBe('p1');
  });

  test('isLastRound detects end of game', () => {
    const room = makeRoom();
    room.maxRounds = 2;
    room.roundHistory = [
      {
        roundNumber: 1,
        category: { id: 1, name: 'A' },
        task: { id: 1, text: 'Starts with letter {letter}', requiresLetter: true },
        letter: 'A',
        readerId: 'p1',
        winnerId: 'p2',
      },
      {
        roundNumber: 2,
        category: { id: 2, name: 'B' },
        task: { id: 2, text: 'Starts with letter {letter}', requiresLetter: true },
        letter: 'B',
        readerId: 'p2',
        winnerId: 'p3',
      },
    ];
    expect(isLastRound(room)).toBe(true);
  });

  test('getRandomReader returns a valid player', () => {
    const room = makeRoom();
    const reader = getRandomReader(room);
    expect(Object.keys(room.players)).toContain(reader);
  });
});
