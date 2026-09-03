import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  __resetPromptLibraryCacheForTests,
  __setPromptFileReaderForTests,
} from '../server/src/utils/promptLibrary';
import {
  __resetRoomStoreForTests,
  attachPlayerToRoom,
  createRoom,
} from '../server/src/models/room';
import {
  HerdMentalityError,
  nextRound,
  revealAnswers,
  startGame,
  submitAnswer,
} from '../server/src/managers/roundManager';
import { buildRoomView } from '../server/src/managers/broadcastManager';

beforeEach(() => {
  __resetRoomStoreForTests();
  __setPromptFileReaderForTests(() => 'prompt\n"Q1"\n"Q2"\n');
});
afterEach(() => {
  __resetPromptLibraryCacheForTests();
  __setPromptFileReaderForTests();
});

function roomWithFour() {
  const room = createRoom('Host', { matchKey: 'match-1', totalRounds: 2, hostPlayerId: 'host' });
  const ids = ['host'];
  for (const name of ['B', 'C', 'D'])
    ids.push(attachPlayerToRoom(room, name, name.toLowerCase()).playerId);
  startGame(room);
  return { room, ids };
}

describe('round lifecycle', () => {
  it('requires four connected players and starts with a prompt', () => {
    const room = createRoom('Host', { matchKey: 'few', totalRounds: 2 });
    expect(() => startGame(room)).toThrow('at least 4');
    const setup = roomWithFour();
    expect(setup.room.phase).toBe('answering');
    expect(['Q1', 'Q2']).toContain(setup.room.prompt?.text);
  });
  it('rejects duplicate submissions and reveals majority scoring privately until reveal', () => {
    const { room, ids } = roomWithFour();
    submitAnswer(room, ids[0]!, ' Pizza ');
    expect(room.phase).toBe('answering');
    expect(() => submitAnswer(room, ids[0]!, 'pizza')).toThrow('already submitted');
    submitAnswer(room, ids[1]!, 'pizza');
    submitAnswer(room, ids[2]!, 'salad');
    submitAnswer(room, ids[3]!, 'salad');
    expect(room.phase).toBe('allSubmitted');
    expect(buildRoomView(room).answers).toEqual([]);
    expect(buildRoomView(room).result).toBeNull();
    revealAnswers(room);
    expect(room.phase).toBe('reveal');
    expect(room.cows.get(ids[0]!)).toBe(1);
    expect(room.cows.get(ids[1]!)).toBe(1);
    expect(room.pinkCowPlayerId).toBeNull();
    expect(room.roundResult?.groups[0]?.count).toBe(2);
  });
  it('gives a sole unmatched answer the Pink Cow and advances to a fresh prompt', () => {
    const { room, ids } = roomWithFour();
    submitAnswer(room, ids[0]!, 'Pizza');
    submitAnswer(room, ids[1]!, 'pizza');
    submitAnswer(room, ids[2]!, 'Pizza');
    submitAnswer(room, ids[3]!, 'Salat');
    revealAnswers(room);
    expect(room.pinkCowPlayerId).toBe(ids[3]);
    nextRound(room);
    expect(room.currentRound).toBe(2);
    expect(room.answers.size).toBe(0);
    expect(room.phase).toBe('answering');
  });
  it('rejects answer and reveal actions in the wrong phase', () => {
    const { room, ids } = roomWithFour();
    expect(() => revealAnswers(room)).toThrow(HerdMentalityError);
    submitAnswer(room, ids[0]!, 'x');
    expect(room.phase).toBe('answering');
  });
  it('blocks a player with the Pink Cow from winning at the target', () => {
    const { room, ids } = roomWithFour();
    room.cows.set(ids[3]!, 8);
    submitAnswer(room, ids[0]!, 'Pizza');
    submitAnswer(room, ids[1]!, 'Pizza');
    submitAnswer(room, ids[2]!, 'Pizza');
    submitAnswer(room, ids[3]!, 'Salat');
    revealAnswers(room);
    expect(room.pinkCowPlayerId).toBe(ids[3]);
    expect(room.roundResult?.winnerIds).toEqual([]);
    expect(room.phase).toBe('reveal');
  });
  it('ends immediately when a non-pink player reaches eight cows', () => {
    const { room, ids } = roomWithFour();
    room.cows.set(ids[0]!, 7);
    submitAnswer(room, ids[0]!, 'Pizza');
    submitAnswer(room, ids[1]!, 'Pizza');
    submitAnswer(room, ids[2]!, 'Pizza');
    submitAnswer(room, ids[3]!, 'Salat');
    revealAnswers(room);
    expect(room.roundResult?.winnerIds).toEqual([ids[0]]);
    expect(room.phase).toBe('ended');
  });
});
