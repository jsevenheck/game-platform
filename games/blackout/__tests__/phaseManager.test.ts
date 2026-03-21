import {
  transitionToPlaying,
  transitionToRoundEnd,
  transitionToEnded,
  transitionToLobby,
} from '../server/src/managers/phaseManager';
import type { Room } from '../core/src/types';

function makeRoom(): Room {
  return {
    code: 'TEST',
    ownerId: 'p1',
    hostId: 'p1',
    phase: 'lobby',
    players: {},
    language: 'de',
    excludedLetters: ['Q', 'X', 'Y'],
    maxRounds: 10,
    currentRound: null,
    roundHistory: [
      {
        roundNumber: 1,
        category: { id: 1, name: 'test' },
        task: { id: 1, text: 'Starts with letter {letter}', requiresLetter: true },
        letter: 'A',
        readerId: 'p1',
        winnerId: null,
      },
    ],
    usedCategoryLetterPairs: new Set(['1:1:A']),
  };
}

describe('phaseManager', () => {
  test('transitionToPlaying sets phase to playing', () => {
    const room = makeRoom();
    transitionToPlaying(room);
    expect(room.phase).toBe('playing');
  });

  test('transitionToRoundEnd sets phase to roundEnd', () => {
    const room = makeRoom();
    transitionToRoundEnd(room);
    expect(room.phase).toBe('roundEnd');
  });

  test('transitionToEnded sets phase to ended', () => {
    const room = makeRoom();
    transitionToEnded(room);
    expect(room.phase).toBe('ended');
  });

  test('transitionToLobby resets room state', () => {
    const room = makeRoom();
    transitionToLobby(room);
    expect(room.phase).toBe('lobby');
    expect(room.currentRound).toBeNull();
    expect(room.roundHistory).toEqual([]);
    expect(room.usedCategoryLetterPairs.size).toBe(0);
  });
});
