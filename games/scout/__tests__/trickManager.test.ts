import { describe, expect, it } from 'vitest';
import type { Room } from '../core/src/types';
import type { ScoutCard } from '../core/src/deck';
import {
  beatsCurrentPlay,
  comparePlays,
  currentTurnPlayerId,
  passAndScout,
  playCards,
  startTrick,
} from '../server/src/managers/trickManager';
import { createPlayer } from '../server/src/models/player';

function card(id: string, playValue: number, scoutPoints = playValue): ScoutCard {
  return { id, kind: 'scout', playValue, scoutPoints, flipped: false };
}

function room(): Room {
  const a = createPlayer('Alice', true, 'a');
  const b = createPlayer('Bob', false, 'b');
  a.row = [card('a1', 3), card('a2', 4), card('a3', 9)];
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
  it('compares plays by sum, then card count, then high card', () => {
    expect(
      comparePlays({ sum: 10, count: 1, highCard: 10 }, { sum: 9, count: 3, highCard: 4 })
    ).toBeGreaterThan(0);
    expect(
      comparePlays({ sum: 9, count: 3, highCard: 4 }, { sum: 9, count: 2, highCard: 5 })
    ).toBeGreaterThan(0);
    expect(
      comparePlays({ sum: 9, count: 2, highCard: 6 }, { sum: 9, count: 2, highCard: 5 })
    ).toBeGreaterThan(0);
  });

  it('validates beating the current play', () => {
    const current = {
      id: 'p',
      playerId: 'a',
      cards: [card('x', 8)],
      sum: 8,
      count: 1,
      highCard: 8,
    };
    expect(beatsCurrentPlay([card('y', 4), card('z', 5)], current)).toBe(true);
    expect(beatsCurrentPlay([card('q', 7)], current)).toBe(false);
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
});
