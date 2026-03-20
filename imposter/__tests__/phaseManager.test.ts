import {
  transitionToPlaying,
  transitionToEnded,
  transitionToLobby,
} from '../server/src/managers/phaseManager';
import type { Room } from '../core/src/types';
import { DEFAULT_WORD_LIBRARY } from '../core/src/constants';

function makeRoom(): Room {
  return {
    code: 'TEST',
    ownerId: 'p1',
    hostId: 'p1',
    phase: 'lobby',
    players: {
      p1: {
        id: 'p1',
        name: 'Alice',
        resumeToken: 't1',
        score: 0,
        connected: true,
        isHost: true,
        socketId: 's1',
      },
      p2: {
        id: 'p2',
        name: 'Bob',
        resumeToken: 't2',
        score: 0,
        connected: true,
        isHost: false,
        socketId: 's2',
      },
      p3: {
        id: 'p3',
        name: 'Charlie',
        resumeToken: 't3',
        score: 0,
        connected: true,
        isHost: false,
        socketId: 's3',
      },
    },
    infiltratorCount: 1,
    discussionDurationMs: 90_000,
    targetScore: 5,
    secretWord: null,
    infiltratorIds: [],
    descriptionOrder: [],
    descriptions: {},
    currentDescriberId: null,
    votes: {},
    roundNumber: 0,
    wordLibrary: [...DEFAULT_WORD_LIBRARY],
    discussionEndsAt: null,
    revealedInfiltrators: [],
    infiltratorGuess: null,
    waitingForGuess: false,
    lastRoundResult: null,
    roundHistory: [],
  };
}

describe('phaseManager', () => {
  test('transitionToPlaying starts a round with description phase', () => {
    const room = makeRoom();
    transitionToPlaying(room);
    expect(room.phase).toBe('description');
    expect(room.secretWord).toBeTruthy();
    expect(room.roundNumber).toBe(1);
  });

  test('transitionToEnded sets phase to ended', () => {
    const room = makeRoom();
    transitionToEnded(room);
    expect(room.phase).toBe('ended');
  });

  test('transitionToLobby resets game state', () => {
    const room = makeRoom();
    transitionToPlaying(room);
    room.players['p1']!.score = 3;
    transitionToLobby(room);
    expect(room.phase).toBe('lobby');
    expect(room.roundNumber).toBe(0);
    expect(room.players['p1']!.score).toBe(0);
  });
});
