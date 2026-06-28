import { describe, expect, it } from 'vitest';
import type { Room } from '../core/src/types';
import type { ScoutCard } from '../core/src/deck';
import {
  beatsCurrentPlay,
  comparePlays,
  currentTurnPlayerId,
  handlePlayerDisconnected,
  passAndScout,
  playCards,
  setupComplete,
  startGame,
  startTrick,
} from '../server/src/managers/trickManager';
import { createPlayer } from '../server/src/models/player';

function card(id: string, playValue: number, scoutPoints = playValue): ScoutCard {
  return { id, kind: 'scout', playValue, scoutPoints, flipped: false };
}

function room(playerCount = 2): Room {
  const a = createPlayer('Alice', true, 'a');
  const b = createPlayer('Bob', false, 'b');
  const c = createPlayer('Carol', false, 'c');
  a.row = [card('a1', 3), card('a2', 3), card('a3', 9)];
  b.row = [card('b1', 5), card('b2', 6), card('b3', 7)];
  c.row = [card('c1', 8), card('c2', 8), card('c3', 10)];
  for (const player of [a, b, c]) {
    player.scoutAndShowTokens = playerCount === 2 ? 3 : 1;
  }
  const players = playerCount === 3 ? { a, b, c } : { a, b };
  const playerOrder = playerCount === 3 ? ['a', 'b', 'c'] : ['a', 'b'];
  return {
    code: 'TEST',
    ownerId: 'a',
    hostId: 'a',
    phase: 'playing',
    players,
    playerOrder,
    showPile: [],
    trick: null,
    trickHistory: [],
    roundHistory: [],
    roundNumber: 1,
    totalRounds: 1,
    roundStartPlayerIndex: 0,
    twoPlayerReserve: [],
    winnerIds: [],
    gameEndReason: null,
  };
}

describe('Scout trick manager', () => {
  it('compares valid Scout plays by official order', () => {
    expect(
      comparePlays(
        { cards: [card('a', 1), card('b', 2), card('c', 3)] },
        { cards: [card('d', 6), card('e', 6)] }
      )
    ).toBeGreaterThan(0);
    expect(
      comparePlays(
        { cards: [card('a', 2), card('b', 2)] },
        { cards: [card('c', 9), card('d', 10)] }
      )
    ).toBeGreaterThan(0);
    expect(
      comparePlays({ cards: [card('a', 5), card('b', 6)] }, { cards: [card('c', 2), card('d', 3)] })
    ).toBeGreaterThan(0);
  });

  it('validates beating the current play', () => {
    const current = {
      id: 'p',
      playerId: 'a',
      cards: [card('x', 4), card('w', 4)],
      kind: 'set' as const,
      count: 2,
      highCard: 4,
      lowCard: 4,
    };
    expect(beatsCurrentPlay([card('y', 5), card('z', 5)], current)).toBe(true);
    expect(beatsCurrentPlay([card('q', 9), card('r', 10)], current)).toBe(false);
    expect(beatsCurrentPlay([card('r', 9)], current)).toBe(false);
  });

  it('accepts a single card as the opening play', () => {
    expect(beatsCurrentPlay([card('x', 1)], null)).toBe(true);
    expect(beatsCurrentPlay([card('x', 7)], null)).toBe(true);
  });

  it('accepts a run of exactly two consecutive cards', () => {
    const twoCardRun = [card('a', 5), card('b', 6)];
    expect(beatsCurrentPlay(twoCardRun, null)).toBe(true);
  });

  it('shows cards, lets the other player scout an edge, and ends the round', () => {
    const r = room();
    startTrick(r, 'a');
    playCards(r, 'a', 0, 2);
    expect(r.players.a.row.map((c) => c.id)).toEqual(['a3']);
    expect(currentTurnPlayerId(r.trick)).toBe('b');

    passAndScout(r, 'b', 'a1', r.players.b.row.length);
    expect(r.players.b.row.map((c) => c.id)).toContain('a1');
    expect(r.phase).toBe('ended');
    expect(r.gameEndReason).toBe('allScouted');
    expect(r.players.a.roundScore).toBe(0);
    expect(r.players.b.roundScore).toBe(-4);
  });

  it('showing a stronger set immediately takes the previous prior set', () => {
    const r = room();
    r.players.b.row = [card('b1', 4), card('b2', 4), card('b3', 7)];
    startTrick(r, 'a');

    playCards(r, 'a', 0, 2);
    playCards(r, 'b', 0, 2);

    expect(r.players.b.takenPile.map((c) => c.id)).toEqual(['a1', 'a2']);
    expect(r.trick?.currentPlay?.playerId).toBe('b');
    expect(currentTurnPlayerId(r.trick)).toBe('a');
  });

  it('awards scout tokens in 3-5p and allows any insert position/orientation', () => {
    const r = room(3);
    startTrick(r, 'a');
    playCards(r, 'a', 0, 2);

    passAndScout(r, 'b', 'a1', 0, true);

    expect(r.players.a.scoutTokens).toBe(1);
    expect(r.players.b.row[0]).toMatchObject({ id: 'a1', playValue: 3, flipped: true });
    expect(currentTurnPlayerId(r.trick)).toBe('c');
    expect(r.phase).toBe('playing');
  });

  it('supports Scout & Show and consumes the round token', () => {
    const r = room(3);
    r.players.b.row = [card('b1', 4), card('b2', 4), card('b3', 7)];
    startTrick(r, 'a');
    playCards(r, 'a', 0, 2);

    passAndScout(r, 'b', 'a1', 3, false, { startIndex: 0, count: 2 });

    expect(r.players.b.scoutAndShowTokens).toBe(0);
    expect(r.players.a.scoutTokens).toBe(1);
    expect(r.players.b.takenPile.map((c) => c.id)).toEqual(['a2']);
    expect(r.trick?.currentPlay?.playerId).toBe('b');
  });

  it('deals official 3-player hands without cards containing 10', () => {
    const r = room(3);
    r.phase = 'lobby';

    startGame(r);

    expect(r.totalRounds).toBe(3);
    for (const playerId of r.playerOrder) {
      expect(r.players[playerId].row).toHaveLength(12);
      expect(r.players[playerId].row.every((c) => c.playValue !== 10 && c.scoutPoints !== 10)).toBe(
        true
      );
    }
  });

  it('deals the scripted E2E opening row to the host even if they joined the room second', () => {
    const originalE2E = process.env.E2E_TESTS;
    process.env.E2E_TESTS = '1';

    try {
      const r = room();
      r.phase = 'lobby';
      r.playerOrder = ['b', 'a'];
      r.hostId = 'a';

      startGame(r);

      expect(r.players.a.row.map((c) => c.playValue)).toEqual([1, 2, 9]);
      expect(r.players.b.row.map((c) => c.playValue)).toEqual([3, 4, 5]);
    } finally {
      if (originalE2E === undefined) delete process.env.E2E_TESTS;
      else process.env.E2E_TESTS = originalE2E;
    }
  });

  it('does not wait for disconnected players during setup', () => {
    const r = room();
    r.players.a.setupConfirmed = true;
    r.players.b.connected = false;

    expect(setupComplete(r)).toBe(true);
  });

  it('ends the round when the only opposing turn player disconnects', () => {
    const r = room();
    startTrick(r, 'a');
    playCards(r, 'a', 0, 2);
    r.players.b.connected = false;

    expect(handlePlayerDisconnected(r)).toBe(true);
    expect(r.phase).toBe('ended');
    expect(r.gameEndReason).toBe('allScouted');
    expect(r.players.a.roundScore).toBe(0);
  });
});
