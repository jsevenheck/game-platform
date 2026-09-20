import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MAX_PLAYERS, GUESS_VALUE_LIMIT } from '@shared/constants';
import {
  __resetQuestionFileReaderForTests,
  __resetQuestionLibraryCacheForTests,
  __setQuestionFileReaderForTests,
} from '../server/src/utils/questionLibrary';
import {
  __resetRoomStoreForTests,
  attachPlayerToRoom,
  createRoom,
  findPlayer,
  getRoomByCode,
  RoomFullError,
} from '../server/src/models/room';
import {
  EstimateError,
  isFiniteGuess,
  nextRound,
  revealSolution,
  restartGame,
  startGame,
  submitGuess,
} from '../server/src/managers/roundManager';
import { buildRoomView } from '../server/src/managers/broadcastManager';
import { computeDisplayRange } from '../core/src/range';
import type { ServerRoom } from '../core/src/types';

// Always reset between tests so the in-memory room/question state doesn't leak.
beforeEach(() => {
  __resetRoomStoreForTests();
  __resetQuestionLibraryCacheForTests();
  __setQuestionFileReaderForTests(() =>
    ['question,answer', '"Q1",10', '"Q2",20', '"Q3",30', '"Q4",40', '"Q5",50'].join('\n')
  );
});

afterEach(() => {
  vi.restoreAllMocks();
  __resetQuestionLibraryCacheForTests();
  __resetQuestionFileReaderForTests();
});

function setupRoomWithPlayers(
  count: number,
  matchKey = 'm1'
): {
  room: ServerRoom;
  players: { id: string }[];
} {
  const room = createRoom('Host', { matchKey, totalRounds: 3 });
  const players: { id: string }[] = [];
  for (let i = 0; i < count - 1; i += 1) {
    const { playerId } = attachPlayerToRoom(room, `P${i + 1}`);
    players.push({ id: playerId });
  }
  return { room, players };
}

describe('isFiniteGuess', () => {
  it('accepts finite numbers within the limit', () => {
    expect(isFiniteGuess(0)).toBe(true);
    expect(isFiniteGuess(1.5)).toBe(true);
    expect(isFiniteGuess(-100)).toBe(true);
    expect(isFiniteGuess(GUESS_VALUE_LIMIT)).toBe(true);
  });

  it('rejects NaN, Infinity, and out-of-range values', () => {
    expect(isFiniteGuess(Number.NaN)).toBe(false);
    expect(isFiniteGuess(Number.POSITIVE_INFINITY)).toBe(false);
    expect(isFiniteGuess(Number.NEGATIVE_INFINITY)).toBe(false);
    expect(isFiniteGuess(GUESS_VALUE_LIMIT + 1)).toBe(false);
    expect(isFiniteGuess(-(GUESS_VALUE_LIMIT + 1))).toBe(false);
  });

  it('rejects non-numbers', () => {
    expect(isFiniteGuess('10' as unknown as number)).toBe(false);
    expect(isFiniteGuess(null as unknown as number)).toBe(false);
    expect(isFiniteGuess(undefined as unknown as number)).toBe(false);
  });
});

describe('startGame', () => {
  it('starts the first round and transitions to guessing', () => {
    const { room } = setupRoomWithPlayers(2);
    startGame(room);
    expect(room.phase).toBe('guessing');
    expect(room.currentRound).toBe(1);
    expect(room.question).not.toBeNull();
    expect(room.question?.answer).toBeOneOf([10, 20, 30, 40, 50]);
    expect(room.guesses.size).toBe(0);
  });

  it('throws if there are too few players', () => {
    const room = createRoom('Host', { matchKey: 'm1' });
    expect(() => startGame(room)).toThrow(EstimateError);
  });

  it('rejects a start when a lobby slot is disconnected', () => {
    const { room, players } = setupRoomWithPlayers(2);
    findPlayer(room, players[0]!.id)!.connected = false;

    expect(() => startGame(room)).toThrow('Need at least 2 connected players');
    expect(room.phase).toBe('lobby');
  });

  it('throws if the game is not in lobby', () => {
    const { room } = setupRoomWithPlayers(2);
    startGame(room);
    expect(() => startGame(room)).toThrow(EstimateError);
  });

  it('refuses to start with more than MAX_PLAYERS players', () => {
    const room = createRoom('Host', { matchKey: 'm1' });
    // Host counts as 1 player, so we can add MAX_PLAYERS-1 more.
    for (let i = 0; i < MAX_PLAYERS - 1; i += 1) {
      attachPlayerToRoom(room, `P${i}`);
    }
    // Adding one more should be blocked.
    expect(() => attachPlayerToRoom(room, 'TooMany')).toThrow(RoomFullError);
  });

  it('requires at least MIN_PLAYERS', () => {
    const room = createRoom('Host', { matchKey: 'm1' });
    expect(() => startGame(room)).toThrow(EstimateError);
  });
});

describe('submitGuess', () => {
  it('records a player guess and keeps the room in guessing until everyone submits', () => {
    const { room, players } = setupRoomWithPlayers(3);
    startGame(room);
    submitGuess(room, room.hostPlayerId, 12);
    expect(room.guesses.size).toBe(1);
    expect(room.phase).toBe('guessing');
    submitGuess(room, players[0]!.id, 8);
    submitGuess(room, players[1]!.id, 20);
    expect(room.phase).toBe('allSubmitted');
  });

  it('is idempotent (overwrites prior guess from same player)', () => {
    const { room, players } = setupRoomWithPlayers(2);
    startGame(room);
    submitGuess(room, players[0]!.id, 5);
    submitGuess(room, players[0]!.id, 7);
    expect(room.guesses.get(players[0]!.id)).toBe(7);
  });

  it('throws on invalid guess values', () => {
    const { room, players } = setupRoomWithPlayers(2);
    startGame(room);
    expect(() => submitGuess(room, players[0]!.id, Number.NaN)).toThrow(EstimateError);
    expect(() => submitGuess(room, players[0]!.id, GUESS_VALUE_LIMIT + 1)).toThrow(EstimateError);
  });

  it('throws when called outside the guessing phase', () => {
    const { room, players } = setupRoomWithPlayers(2);
    expect(() => submitGuess(room, players[0]!.id, 5)).toThrow(EstimateError);
  });

  it('throws when the player is not in the room', () => {
    const { room } = setupRoomWithPlayers(2);
    startGame(room);
    expect(() => submitGuess(room, 'nobody', 5)).toThrow(EstimateError);
  });
});

describe('revealSolution', () => {
  it('awards +1 to the closest guesser and reveals the solution', () => {
    const { room, players } = setupRoomWithPlayers(3);
    startGame(room);
    // Q1..Q5 have answers 10, 20, 30, 40, 50 — current question is one of them.
    const answer = room.question!.answer;
    submitGuess(room, room.hostPlayerId, answer + 100); // far off
    submitGuess(room, players[0]!.id, answer + 1); // closest
    submitGuess(room, players[1]!.id, answer + 5);
    // Auto-transitioned to allSubmitted already (all submitted).
    expect(room.phase).toBe('allSubmitted');
    revealSolution(room);
    expect(room.phase).toBe('reveal');
    expect(room.scores.get(players[0]!.id)).toBe(1);
    expect(room.scores.get(room.hostPlayerId)).toBe(0);
    expect(room.scores.get(players[1]!.id)).toBe(0);
  });

  it('awards +1 to every tied player', () => {
    const { room, players } = setupRoomWithPlayers(3);
    startGame(room);
    const answer = room.question!.answer;
    submitGuess(room, room.hostPlayerId, answer + 2);
    submitGuess(room, players[0]!.id, answer - 2); // tie at distance 2
    submitGuess(room, players[1]!.id, answer + 50);
    revealSolution(room);
    expect(room.scores.get(room.hostPlayerId)).toBe(1);
    expect(room.scores.get(players[0]!.id)).toBe(1);
    expect(room.scores.get(players[1]!.id)).toBe(0);
  });

  it('throws when called before all players submitted', () => {
    const { room } = setupRoomWithPlayers(2);
    startGame(room);
    submitGuess(room, room.hostPlayerId, 5);
    expect(() => revealSolution(room)).toThrow(EstimateError);
  });
});

describe('nextRound / restartGame', () => {
  it('advances to the next round until totalRounds, then finishes the game', () => {
    const { room, players } = setupRoomWithPlayers(2, 'm-advance');
    startGame(room);
    expect(room.currentRound).toBe(1);

    for (let i = 0; i < 3; i += 1) {
      submitGuess(room, room.hostPlayerId, 1);
      submitGuess(room, players[0]!.id, 1);
      revealSolution(room);
      if (i < 2) {
        // Last iteration: nextRound will end the game instead of advancing.
        nextRound(room);
        expect(room.phase).toBe('guessing');
      }
    }
    // After 3 rounds, the final nextRound from 'reveal' ends the game.
    nextRound(room);
    expect(room.phase).toBe('ended');
  });

  it('does not repeat a question within one game', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const { room, players } = setupRoomWithPlayers(2, 'm-unique-questions');
    startGame(room);
    const questionIds = new Set([room.question!.id]);

    for (let round = 1; round < room.totalRounds; round += 1) {
      submitGuess(room, room.hostPlayerId, 1);
      submitGuess(room, players[0]!.id, 2);
      revealSolution(room);
      nextRound(room);
      expect(questionIds.has(room.question!.id)).toBe(false);
      questionIds.add(room.question!.id);
    }

    expect(questionIds.size).toBe(room.totalRounds);
  });

  it('throws when called outside the reveal phase', () => {
    const { room } = setupRoomWithPlayers(2);
    startGame(room);
    expect(() => nextRound(room)).toThrow(EstimateError);
  });

  it('restartGame resets scores and returns to lobby', () => {
    const { room, players } = setupRoomWithPlayers(2);
    startGame(room);
    submitGuess(room, room.hostPlayerId, 1);
    submitGuess(room, players[0]!.id, 1);
    revealSolution(room);
    nextRound(room); // round 2
    submitGuess(room, room.hostPlayerId, 1);
    submitGuess(room, players[0]!.id, 1);
    revealSolution(room);
    nextRound(room); // round 3
    submitGuess(room, room.hostPlayerId, 1);
    submitGuess(room, players[0]!.id, 1);
    revealSolution(room);
    nextRound(room); // game ends
    expect(room.phase).toBe('ended');
    restartGame(room);
    expect(room.phase).toBe('lobby');
    expect(room.currentRound).toBe(0);
    expect(room.question).toBeNull();
    expect(room.guesses.size).toBe(0);
    for (const p of room.players) {
      expect(room.scores.get(p.id)).toBe(0);
    }
  });
});

describe('buildRoomView', () => {
  it('keeps partial guesses and their derived range private during guessing', () => {
    const { room } = setupRoomWithPlayers(2);
    startGame(room);
    submitGuess(room, room.hostPlayerId, 123);

    const view = buildRoomView(room);
    expect(view.phase).toBe('guessing');
    expect(view.guesses).toEqual([]);
    expect(view.displayRange).toBeNull();
    expect(view.players.find((p) => p.id === room.hostPlayerId)?.hasSubmitted).toBe(true);
  });

  it('hides the solution before reveal and shows it after', () => {
    const { room, players } = setupRoomWithPlayers(3);
    const view = buildRoomView(room);
    expect(view.solution).toBeNull();
    expect(view.question).toBeNull();

    startGame(room);
    submitGuess(room, room.hostPlayerId, 1);
    submitGuess(room, players[0]!.id, 1);
    submitGuess(room, players[1]!.id, 1);

    const afterAllSubmitted = buildRoomView(room);
    expect(afterAllSubmitted.solution).toBeNull(); // still hidden in 'allSubmitted'
    expect(afterAllSubmitted.guesses.length).toBe(3);
    expect(afterAllSubmitted.players.find((p) => p.id === players[0]!.id)?.hasSubmitted).toBe(true);

    revealSolution(room);
    const afterReveal = buildRoomView(room);
    expect(afterReveal.solution).toBe(room.question!.answer);
    expect(afterReveal.winners.length).toBeGreaterThan(0);
  });

  it('exposes the exact padded display range once all guesses are public', () => {
    const { room, players } = setupRoomWithPlayers(2);
    startGame(room);
    submitGuess(room, room.hostPlayerId, 1);
    submitGuess(room, players[0]!.id, 10);
    const view = buildRoomView(room);
    expect(view.displayRange?.lo).toBeCloseTo(0.1);
    expect(view.displayRange?.hi).toBeCloseTo(10.9);
  });

  it('marks players who have not yet submitted as hasSubmitted: false', () => {
    const { room, players } = setupRoomWithPlayers(3);
    startGame(room);
    submitGuess(room, room.hostPlayerId, 1);
    const view = buildRoomView(room);
    expect(view.players.find((p) => p.id === room.hostPlayerId)?.hasSubmitted).toBe(true);
    expect(view.players.find((p) => p.id === players[0]!.id)?.hasSubmitted).toBe(false);
  });
});

describe('computeDisplayRange', () => {
  it('pads the guess span before extending to a distant solution', () => {
    expect(computeDisplayRange([0, 10], 1000)).toEqual({ lo: -1, hi: 1000 });
  });

  it('uses a stable two-unit range for equal guesses', () => {
    expect(computeDisplayRange([10, 10])).toEqual({ lo: 9, hi: 11 });
  });

  it('supports negative and decimal guesses', () => {
    expect(computeDisplayRange([-2.5, 2.5])).toEqual({ lo: -3, hi: 3 });
  });

  it('returns the default minimum span for no values', () => {
    expect(computeDisplayRange([])).toEqual({ lo: 0, hi: 2 });
  });
});

describe('findPlayer / getRoomByCode smoke', () => {
  it('finds an existing player in the room', () => {
    const { room } = setupRoomWithPlayers(2);
    expect(findPlayer(room, room.hostPlayerId)?.name).toBe('Host');
  });
  it('returns undefined for unknown player', () => {
    const { room } = setupRoomWithPlayers(2);
    expect(findPlayer(room, 'unknown')).toBeUndefined();
  });
  it('looks up a room by its code', () => {
    const { room } = setupRoomWithPlayers(2);
    expect(getRoomByCode(room.roomCode)).toBe(room);
  });
});
