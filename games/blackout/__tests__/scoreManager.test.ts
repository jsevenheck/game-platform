import {
  addPoint,
  getLeaderboard,
  getWinners,
  resetScores,
} from '../server/src/managers/scoreManager';
import type { Room } from '../core/src/types';

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

describe('scoreManager', () => {
  test('addPoint increments player score', () => {
    const room = makeRoom();
    addPoint(room, 'p1');
    expect(room.players.p1.score).toBe(1);
    addPoint(room, 'p1');
    expect(room.players.p1.score).toBe(2);
  });

  test('getLeaderboard returns sorted players', () => {
    const room = makeRoom();
    room.players.p2.score = 3;
    room.players.p1.score = 1;
    room.players.p3.score = 2;
    const lb = getLeaderboard(room);
    expect(lb[0].id).toBe('p2');
    expect(lb[1].id).toBe('p3');
    expect(lb[2].id).toBe('p1');
  });

  test('getWinners returns tied winners', () => {
    const room = makeRoom();
    room.players.p1.score = 5;
    room.players.p2.score = 5;
    room.players.p3.score = 3;
    const winners = getWinners(room);
    expect(winners).toContain('p1');
    expect(winners).toContain('p2');
    expect(winners).not.toContain('p3');
  });

  test('resetScores sets all scores to 0', () => {
    const room = makeRoom();
    room.players.p1.score = 5;
    room.players.p2.score = 3;
    resetScores(room);
    expect(room.players.p1.score).toBe(0);
    expect(room.players.p2.score).toBe(0);
  });
});
