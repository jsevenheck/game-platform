import {
  initGameState,
  setInfiltratorCount,
  setDiscussionDuration,
  setTargetScore,
  addWordToLibrary,
  getRandomDescriptionOrder,
  startRound,
  selectRandomInfiltrators,
  submitDescription,
  skipCurrentDescription,
  submitVote,
  allVotesSubmitted,
  allDescriptionsSubmitted,
  resolveVotes,
  handleInfiltratorGuess,
  resetForLobby,
} from '../server/src/managers/gameManager';
import type { Room } from '../core/src/types';
import {
  DEFAULT_TARGET_SCORE,
  MIN_DISCUSSION_DURATION_MS,
  MAX_DISCUSSION_DURATION_MS,
  MIN_TARGET_SCORE,
} from '../core/src/constants';
import * as helperUtils from '../server/src/utils/helpers';

function makeRoom(playerCount = 4): Room {
  const room: Room = {
    code: 'TEST',
    ownerId: 'p1',
    hostId: 'p1',
    phase: 'lobby',
    players: {},
    infiltratorCount: 1,
    discussionDurationMs: 90_000,
    targetScore: DEFAULT_TARGET_SCORE,
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

  for (let i = 1; i <= playerCount; i++) {
    room.players[`p${i}`] = {
      id: `p${i}`,
      name: `Player ${i}`,
      resumeToken: `token-${i}`,
      score: 0,
      connected: true,
      isHost: i === 1,
      socketId: `socket-${i}`,
    };
  }

  initGameState(room);
  // Override word library with a fixed set so tests are isolated from server/data/words.txt
  room.wordLibrary = ['Apfel', 'Strand', 'Schloss', 'Drachen', 'Elefant'];
  return room;
}

describe('gameManager', () => {
  beforeEach(() => {
    vi.spyOn(helperUtils, 'getRandomInt').mockImplementation((maxExclusive: number) => {
      return maxExclusive - 1;
    });
    vi.spyOn(helperUtils, 'shuffle').mockImplementation(<T>(arr: T[]) => [...arr]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initGameState', () => {
    test('initializes default word library', () => {
      const room = makeRoom();
      expect(room.wordLibrary.length).toBeGreaterThan(0);
      expect(room.infiltratorCount).toBe(1);
      expect(room.targetScore).toBe(DEFAULT_TARGET_SCORE);
    });
  });

  describe('setInfiltratorCount', () => {
    test('accepts valid count', () => {
      const room = makeRoom(4);
      const err = setInfiltratorCount(room, 2);
      expect(err).toBeNull();
      expect(room.infiltratorCount).toBe(2);
    });

    test('accepts zero (paranoia mode)', () => {
      const room = makeRoom(4);
      const err = setInfiltratorCount(room, 0);
      expect(err).toBeNull();
      expect(room.infiltratorCount).toBe(0);
    });

    test('rejects count >= player count', () => {
      const room = makeRoom(4);
      const err = setInfiltratorCount(room, 4);
      expect(err).not.toBeNull();
    });

    test('rejects negative count', () => {
      const room = makeRoom(4);
      const err = setInfiltratorCount(room, -1);
      expect(err).not.toBeNull();
    });
  });

  describe('addWordToLibrary', () => {
    test('adds a new word', () => {
      const room = makeRoom();
      const initialCount = room.wordLibrary.length;
      const err = addWordToLibrary(room, 'Zeppelin');
      expect(err).toBeNull();
      expect(room.wordLibrary.length).toBe(initialCount + 1);
      expect(room.wordLibrary).toContain('Zeppelin');
    });

    test('rejects duplicate words (case insensitive)', () => {
      const room = makeRoom();
      addWordToLibrary(room, 'TestWord');
      const err = addWordToLibrary(room, 'testword');
      expect(err).not.toBeNull();
    });

    test('rejects empty word', () => {
      const room = makeRoom();
      const err = addWordToLibrary(room, '   ');
      expect(err).not.toBeNull();
    });
  });

  describe('setDiscussionDuration', () => {
    test('accepts valid duration', () => {
      const room = makeRoom();
      const err = setDiscussionDuration(room, MIN_DISCUSSION_DURATION_MS);
      expect(err).toBeNull();
      expect(room.discussionDurationMs).toBe(MIN_DISCUSSION_DURATION_MS);
    });

    test('rejects out of range duration', () => {
      const room = makeRoom();
      const err = setDiscussionDuration(room, MAX_DISCUSSION_DURATION_MS + 15_000);
      expect(err).not.toBeNull();
    });
  });

  describe('setTargetScore', () => {
    test('accepts valid target score', () => {
      const room = makeRoom();
      const err = setTargetScore(room, MIN_TARGET_SCORE + 1);
      expect(err).toBeNull();
      expect(room.targetScore).toBe(MIN_TARGET_SCORE + 1);
    });

    test('rejects target score below minimum', () => {
      const room = makeRoom();
      const err = setTargetScore(room, MIN_TARGET_SCORE - 1);
      expect(err).not.toBeNull();
    });
  });

  describe('startRound', () => {
    test('picks a secret word and assigns infiltrators', () => {
      const room = makeRoom(4);
      room.infiltratorCount = 1;
      startRound(room);

      expect(room.secretWord).toBeTruthy();
      expect(room.infiltratorIds.length).toBe(1);
      expect(room.infiltratorIds).toEqual(['p1']);
      expect(room.descriptionOrder).toEqual(['p1', 'p2', 'p3', 'p4']);
      expect(room.currentDescriberId).toBe('p1');
      expect(room.phase).toBe('description');
      expect(room.roundNumber).toBe(1);
    });

    test('paranoia mode: zero infiltrators', () => {
      const room = makeRoom(4);
      room.infiltratorCount = 0;
      startRound(room);

      expect(room.infiltratorIds.length).toBe(0);
      expect(room.secretWord).toBeTruthy();
      expect(room.phase).toBe('description');
    });

    test('multiple infiltrators', () => {
      const room = makeRoom(6);
      room.infiltratorCount = 3;
      startRound(room);

      expect(room.infiltratorIds.length).toBe(3);
    });
  });

  describe('random round helpers', () => {
    test('randomizes clue order outside deterministic test mode', () => {
      vi.restoreAllMocks();
      const shuffleSpy = vi.spyOn(helperUtils, 'shuffle').mockReturnValue(['p2', 'p3', 'p1']);

      const descriptionOrder = getRandomDescriptionOrder(['p1', 'p2', 'p3']);

      expect(descriptionOrder).toEqual(['p2', 'p3', 'p1']);

      shuffleSpy.mockRestore();
    });

    test('randomly selects infiltrators outside deterministic test mode', () => {
      vi.restoreAllMocks();
      const shuffleSpy = vi.spyOn(helperUtils, 'shuffle').mockReturnValue(['p2', 'p3', 'p1']);

      const infiltratorIds = selectRandomInfiltrators(['p1', 'p2', 'p3'], 2);

      expect(infiltratorIds).toEqual(['p2', 'p3']);

      shuffleSpy.mockRestore();
    });

    test('host remains eligible for infiltrator selection', () => {
      const infiltratorIds = selectRandomInfiltrators(['p1', 'p2', 'p3'], 1);

      expect(infiltratorIds).toEqual(['p1']);
    });
  });

  describe('submitDescription', () => {
    test('accepts valid description', () => {
      const room = makeRoom(3);
      startRound(room);
      expect(room.currentDescriberId).toBe('p1');
      const err = submitDescription(room, 'p1', 'fruit');
      expect(err).toBeNull();
      expect(room.descriptions['p1']).toBe('fruit');
      expect(room.currentDescriberId).toBe('p2');
    });

    test('rejects duplicate submission', () => {
      const room = makeRoom(3);
      startRound(room);
      submitDescription(room, 'p1', 'fruit');
      const err = submitDescription(room, 'p1', 'another');
      expect(err).not.toBeNull();
    });

    test('rejects in wrong phase', () => {
      const room = makeRoom(3);
      room.phase = 'lobby';
      const err = submitDescription(room, 'p1', 'fruit');
      expect(err).not.toBeNull();
    });

    test('rejects clue submission out of turn', () => {
      const room = makeRoom(3);
      startRound(room);
      const err = submitDescription(room, 'p2', 'fruit');
      expect(err).toBe('Waiting for Player 1 to enter a clue');
      expect(room.descriptions['p2']).toBeUndefined();
    });

    test('auto-transitions to discussion when all submit', () => {
      const room = makeRoom(3);
      startRound(room);
      submitDescription(room, 'p1', 'clue1');
      submitDescription(room, 'p2', 'clue2');
      submitDescription(room, 'p3', 'clue3');
      expect(room.phase).toBe('discussion');
    });

    test('host can skip the current clue turn', () => {
      const room = makeRoom(3);
      startRound(room);

      const err = skipCurrentDescription(room);

      expect(err).toBeNull();
      expect(room.descriptions['p1']).toBe('');
      expect(room.currentDescriberId).toBe('p2');
    });
  });

  describe('allDescriptionsSubmitted', () => {
    test('returns false when not all submitted', () => {
      const room = makeRoom(3);
      startRound(room);
      submitDescription(room, 'p1', 'clue');
      expect(allDescriptionsSubmitted(room)).toBe(false);
    });
  });

  describe('voting', () => {
    test('submitVote records vote', () => {
      const room = makeRoom(3);
      room.phase = 'voting';
      const err = submitVote(room, 'p1', 'p2');
      expect(err).toBeNull();
      expect(room.votes['p1']).toBe('p2');
    });

    test('rejects self-vote', () => {
      const room = makeRoom(3);
      room.phase = 'voting';
      const err = submitVote(room, 'p1', 'p1');
      expect(err).not.toBeNull();
    });

    test('rejects duplicate vote', () => {
      const room = makeRoom(3);
      room.phase = 'voting';
      submitVote(room, 'p1', 'p2');
      const err = submitVote(room, 'p1', 'p3');
      expect(err).not.toBeNull();
    });

    test('allVotesSubmitted returns true when all voted', () => {
      const room = makeRoom(3);
      room.phase = 'voting';
      submitVote(room, 'p1', 'p2');
      submitVote(room, 'p2', 'p1');
      submitVote(room, 'p3', 'p1');
      expect(allVotesSubmitted(room)).toBe(true);
    });
  });

  describe('resolveVotes', () => {
    test('catches infiltrator when voted out', () => {
      const room = makeRoom(3);
      startRound(room);
      const infiltratorId = room.infiltratorIds[0]!;
      room.phase = 'voting';

      // All non-infiltrators vote for the infiltrator
      for (const pid of Object.keys(room.players)) {
        if (pid !== infiltratorId) {
          submitVote(room, pid, infiltratorId);
        }
      }
      // Infiltrator votes for someone else
      const someoneElse = Object.keys(room.players).find((id) => id !== infiltratorId)!;
      submitVote(room, infiltratorId, someoneElse);

      resolveVotes(room);

      expect(room.phase).toBe('reveal');
      expect(room.revealedInfiltrators).toContain(infiltratorId);
      expect(room.waitingForGuess).toBe(true);
    });

    test('ends the match when target score is reached', () => {
      const room = makeRoom(3);
      startRound(room);
      room.targetScore = 2;
      room.phase = 'voting';

      const infiltratorId = room.infiltratorIds[0]!;
      const civilianId = Object.keys(room.players).find((id) => id !== infiltratorId)!;

      for (const playerId of Object.keys(room.players)) {
        submitVote(room, playerId, civilianId);
      }

      resolveVotes(room);

      expect(room.phase).toBe('ended');
      expect(room.lastRoundResult?.winner).toBe('infiltrators');
      expect(room.players[infiltratorId]?.score).toBe(2);
    });
  });

  describe('handleInfiltratorGuess', () => {
    test('correct guess', () => {
      const room = makeRoom(3);
      startRound(room);
      room.phase = 'reveal';
      room.waitingForGuess = true;
      room.revealedInfiltrators = [room.infiltratorIds[0]!];
      // Set up votes for finalization
      const ids = Object.keys(room.players);
      room.votes = {
        [ids[0]!]: ids[1]!,
        [ids[1]!]: ids[0]!,
        [ids[2]!]: ids[0]!,
      };

      const err = handleInfiltratorGuess(room, room.secretWord!);
      expect(err).toBeNull();
      expect(room.lastRoundResult).not.toBeNull();
      expect(room.lastRoundResult?.infiltratorGuessCorrect).toBe(true);
      expect(room.lastRoundResult?.winner).toBe('infiltrators');
    });

    test('incorrect guess', () => {
      const room = makeRoom(3);
      startRound(room);
      room.phase = 'reveal';
      room.waitingForGuess = true;
      room.revealedInfiltrators = [room.infiltratorIds[0]!];
      const ids = Object.keys(room.players);
      room.votes = {
        [ids[0]!]: ids[1]!,
        [ids[1]!]: ids[0]!,
        [ids[2]!]: ids[0]!,
      };

      const err = handleInfiltratorGuess(room, 'TotallyWrong');
      expect(err).toBeNull();
      expect(room.lastRoundResult?.infiltratorGuessCorrect).toBe(false);
      expect(room.lastRoundResult?.winner).toBe('civilians');
    });

    test('ends the match after a civilian round win when target score is reached', () => {
      const room = makeRoom(3);
      startRound(room);
      room.targetScore = 1;
      room.phase = 'reveal';
      room.waitingForGuess = true;
      room.revealedInfiltrators = [room.infiltratorIds[0]!];
      const ids = Object.keys(room.players);
      room.votes = {
        [ids[0]!]: ids[1]!,
        [ids[1]!]: ids[0]!,
        [ids[2]!]: ids[0]!,
      };

      const err = handleInfiltratorGuess(room, 'TotallyWrong');
      expect(err).toBeNull();
      expect(room.phase).toBe('ended');
      expect(room.lastRoundResult?.winner).toBe('civilians');
    });
  });

  describe('resetForLobby', () => {
    test('resets all game state', () => {
      const room = makeRoom(3);
      startRound(room);
      room.players['p1']!.score = 5;
      resetForLobby(room);

      expect(room.phase).toBe('lobby');
      expect(room.roundNumber).toBe(0);
      expect(room.secretWord).toBeNull();
      expect(room.infiltratorIds).toEqual([]);
      expect(room.players['p1']!.score).toBe(0);
      expect(room.roundHistory).toEqual([]);
    });
  });
});
