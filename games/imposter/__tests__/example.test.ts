import { startRound, submitDescription, initGameState } from '../server/src/managers/gameManager';
import type { Room } from '../core/src/types';
import * as helperUtils from '../server/src/utils/helpers';

beforeEach(() => {
  vi.spyOn(helperUtils, 'getRandomInt').mockImplementation((maxExclusive: number) => {
    return maxExclusive - 1;
  });
  vi.spyOn(helperUtils, 'shuffle').mockImplementation(<T>(arr: T[]) => [...arr]);
});

afterEach(() => {
  vi.restoreAllMocks();
});

function makeRoom(playerCount = 3): Room {
  const room: Room = {
    code: 'TEST',
    ownerId: 'p1',
    hostId: 'p1',
    phase: 'lobby',
    players: {},
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
    wordLibrary: [],
    discussionEndsAt: null,
    revealedInfiltrators: [],
    infiltratorGuess: null,
    waitingForGuess: false,
    lastRoundResult: null,
    roundHistory: [],
  };
  initGameState(room);
  for (let i = 1; i <= playerCount; i++) {
    room.players[`p${i}`] = {
      id: `p${i}`,
      name: `Player ${i}`,
      socketId: `s${i}`,
      connected: true,
      isHost: i === 1,
      resumeToken: `token${i}`,
      score: 0,
    };
  }
  return room;
}

describe('startRound', () => {
  it('assigns exactly one infiltrator by default', () => {
    const room = makeRoom(3);
    startRound(room);
    expect(room.phase).toBe('description');
    expect(room.infiltratorIds).toHaveLength(1);
    expect(room.secretWord).toBeTruthy();
  });
});

describe('submitDescription', () => {
  it('transitions to discussion when all players submit', () => {
    const room = makeRoom(3);
    startRound(room);
    const ids = Object.keys(room.players);
    submitDescription(room, ids[0]!, 'clue1');
    submitDescription(room, ids[1]!, 'clue2');
    expect(room.phase).toBe('description');
    submitDescription(room, ids[2]!, 'clue3');
    expect(room.phase).toBe('discussion');
  });
});
