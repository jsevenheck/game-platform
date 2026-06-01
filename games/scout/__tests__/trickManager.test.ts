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

function room(): Room {
  const a = createPlayer('Alice', true, 'a');
  const b = createPlayer('Bob', false, 'b');
  a.row = [card('a1', 3), card('a2', 3), card('a3', 9)];
  b.row = [card('b1', 5), card('b2', 6), card('b3', 7)];
  return {
    code: 'TEST',
    ownerId: 'a',
    hostId: 'a',
    phase: 'playing',
    players: { a, b },
    playerOrder: ['a', 'b'],
    showPile: [card('s1', 1, 10)],
    trick: null,
    trickHistory: [],
    winnerIds: [],
    gameEndReason: null,
  };
}

describe('Scout trick manager', () => {
  it('compares valid Scout plays by strength, then high card', () => {
    expect(
      comparePlays({ cards: [card('a', 5), card('b', 5)] }, { cards: [card('c', 4), card('d', 4)] })
    ).toBeGreaterThan(0);
    expect(
      comparePlays(
        { cards: [card('a', 1), card('b', 2), card('c', 3)] },
        { cards: [card('d', 6), card('e', 6)] }
      )
    ).toBeLessThan(0);
    expect(
      comparePlays(
        { cards: [card('a', 5), card('b', 5)] },
        { cards: [card('c', 2), card('d', 3), card('e', 4)] }
      )
    ).toBeLessThan(0);
  });

  it('validates beating the current play', () => {
    const current = {
      id: 'p',
      playerId: 'a',
      cards: [card('x', 4), card('w', 4)],
      sum: 8,
      count: 2,
      highCard: 4,
    };
    expect(beatsCurrentPlay([card('y', 5), card('z', 5)], current)).toBe(true);
    // single 7 has strength 7, pair of 4s has strength 8 — does not beat
    expect(beatsCurrentPlay([card('q', 7)], current)).toBe(false);
    // single 9 has strength 9 > 8 — beats it
    expect(beatsCurrentPlay([card('r', 9)], current)).toBe(true);
  });

  it('accepts a single card as the opening play (no current play on table)', () => {
    expect(beatsCurrentPlay([card('x', 1)], null)).toBe(true);
    expect(beatsCurrentPlay([card('x', 7)], null)).toBe(true);
  });

  it('accepts a run of exactly two same-color consecutive cards', () => {
    const twoCardRun = [card('a', 5), card('b', 6)];
    expect(beatsCurrentPlay(twoCardRun, null)).toBe(true);
  });

  it('plays contiguous cards and resolves when the other player scouts', () => {
    const r = room();
    startTrick(r, 'a');
    playCards(r, 'a', 0, 2);
    expect(r.players.a.row.map((c) => c.id)).toEqual(['a3']);
    expect(currentTurnPlayerId(r.trick)).toBe('b');

    passAndScout(r, 'b', 'showPile', 'right', 's1');
    expect(r.players.b.row.map((c) => c.id)).toContain('s1');
    expect(r.players.a.takenPile.map((c) => c.id)).toEqual(['a1', 'a2']);
    expect(r.trick?.leaderId).toBe('a');
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

  it('resolves the trick when the current turn player disconnects', () => {
    const r = room();
    startTrick(r, 'a');
    playCards(r, 'a', 0, 2);
    r.players.b.connected = false;

    expect(handlePlayerDisconnected(r)).toBe(true);
    expect(r.players.a.takenPile.map((c) => c.id)).toEqual(['a1', 'a2']);
    expect(r.trick?.leaderId).toBe('a');
    expect(currentTurnPlayerId(r.trick)).toBe('a');
  });
});
