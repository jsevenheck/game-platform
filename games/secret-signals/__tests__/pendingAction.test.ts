import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RoomView } from '../core/src/types';
import {
  actionConfirmed,
  createPendingAction,
  type ActionIntent,
} from '../ui-vue/src/lib/pendingAction';

function room(overrides: Partial<RoomView> = {}): RoomView {
  return {
    code: 'TEST',
    phase: 'playing',
    players: [
      { id: 'me', name: 'Me', score: 0, connected: true, isHost: true, team: 'red', role: 'agent' },
    ],
    board: [{ word: 'TREE', type: null, revealed: false, revealedBy: null }],
    teams: [],
    currentTurnTeam: 'red',
    turnPhase: 'guessing',
    currentSignal: null,
    turnOrder: ['red', 'blue'],
    log: [],
    winnerTeam: null,
    winningTeams: [],
    teamCount: 2,
    assassinPenaltyMode: 'instant-loss',
    focusedCards: [],
    ...overrides,
  };
}

afterEach(() => vi.useRealTimers());

describe('action-specific authoritative reconciliation', () => {
  const cases: Array<[ActionIntent, Partial<RoomView>, Partial<RoomView>]> = [
    [
      { kind: 'team', value: 'blue' },
      {},
      { players: room().players.map((p) => ({ ...p, team: 'blue' })) },
    ],
    [
      { kind: 'role', value: 'director' },
      {},
      { players: room().players.map((p) => ({ ...p, role: 'director' })) },
    ],
    [{ kind: 'teamCount', value: 3 }, {}, { teamCount: 3 }],
    [{ kind: 'penalty', value: 'elimination' }, {}, { assassinPenaltyMode: 'elimination' }],
    [{ kind: 'start' }, { phase: 'lobby' }, { phase: 'playing' }],
    [{ kind: 'restart' }, { phase: 'ended' }, { phase: 'lobby' }],
    [{ kind: 'mark', value: 0 }, {}, { focusedCards: [{ playerId: 'me', cardIndex: 0 }] }],
    [{ kind: 'mark', value: null }, { focusedCards: [{ playerId: 'me', cardIndex: 0 }] }, {}],
    [
      { kind: 'signal', word: 'ALPHA', number: 1 },
      { turnPhase: 'giving-signal' },
      { currentSignal: { word: 'ALPHA', number: 1, teamColor: 'red', guessesUsed: 0 } },
    ],
    [
      { kind: 'reveal', value: 0 },
      {},
      { board: [{ word: 'TREE', type: 'red', revealed: true, revealedBy: 'red' }] },
    ],
    [{ kind: 'end' }, {}, { currentTurnTeam: 'blue', turnPhase: 'giving-signal' }],
    [{ kind: 'skip' }, {}, { currentTurnTeam: 'blue', turnPhase: 'giving-signal' }],
  ];
  it.each(cases)(
    'confirms %j without ACK, not unrelated presence updates',
    (intent, beforeFields, afterFields) => {
      vi.useFakeTimers();
      const actions = createPendingAction(() => 'timeout');
      const before = room(beforeFields);
      actions.begin(intent, before, 'me');
      actions.reconcile({
        ...before,
        players: before.players.map((p) => ({ ...p, connected: false })),
      });
      expect(actions.pending.value).toBe(true);
      actions.reconcile(room(afterFields));
      expect(actions.pending.value).toBe(false);
      vi.advanceTimersByTime(8001);
      expect(actions.error.value).toBe('');
    }
  );
  it.each(['alpha', ' Alpha ', 'aLpHa'])(
    'reconciles the server-normalized clue %j without ACK or false timeout',
    (word) => {
      vi.useFakeTimers();
      const actions = createPendingAction(() => 'timeout');
      actions.begin(
        { kind: 'signal', word, number: 1 },
        room({ turnPhase: 'giving-signal' }),
        'me'
      );
      actions.reconcile(
        room({ currentSignal: { word: 'ALPHA', number: 1, teamColor: 'red', guessesUsed: 0 } })
      );
      expect(actions.pending.value).toBe(false);
      vi.advanceTimersByTime(8001);
      expect(actions.error.value).toBe('');
    }
  );
  it('requires the own mark, target card and matching room', () => {
    expect(
      actionConfirmed(
        { kind: 'mark', value: 0 },
        room(),
        room({ focusedCards: [{ playerId: 'other', cardIndex: 0 }] }),
        'me'
      )
    ).toBe(false);
    expect(actionConfirmed({ kind: 'reveal', value: 0 }, room(), room(), 'me')).toBe(false);
    expect(
      actionConfirmed({ kind: 'start' }, room({ phase: 'lobby' }), room({ code: 'OTHER' }), 'me')
    ).toBe(false);
  });
  it('late ACK after broadcast cannot clear or reject a newer action', () => {
    vi.useFakeTimers();
    const actions = createPendingAction(() => 'timeout');
    const old = actions.begin({ kind: 'start' }, room({ phase: 'lobby' }), 'me')!;
    actions.reconcile(room());
    const current = actions.begin({ kind: 'mark', value: 0 }, room(), 'me')!;
    old({ ok: false, error: 'stale rejection' });
    expect(actions.pending.value).toBe(true);
    expect(actions.error.value).toBe('');
    current({ ok: false, error: 'real rejection' });
    expect(actions.pending.value).toBe(false);
    expect(actions.error.value).toBe('real rejection');
  });
  it('times out only unresolved work; duplicate activation cannot replace ownership', () => {
    vi.useFakeTimers();
    const actions = createPendingAction(() => 'timeout');
    const old = actions.begin({ kind: 'mark', value: 0 }, room(), 'me')!;
    expect(actions.begin({ kind: 'end' }, room(), 'me')).toBeNull();
    vi.advanceTimersByTime(8000);
    expect(actions.error.value).toBe('timeout');
    actions.begin({ kind: 'end' }, room(), 'me');
    old({ ok: true });
    expect(actions.pending.value).toBe(true);
    actions.invalidate();
  });
  it.each(['disconnect', 'unmount'])(
    '%s invalidates old ACKs and cancels its timer before resume/new owner',
    () => {
      vi.useFakeTimers();
      const actions = createPendingAction(() => 'timeout');
      const old = actions.begin({ kind: 'mark', value: 0 }, room(), 'me')!;
      actions.invalidate();
      actions.begin({ kind: 'end' }, room(), 'me');
      old({ ok: false, error: 'stale' });
      expect(actions.pending.value).toBe(true);
      expect(actions.error.value).toBe('');
      actions.invalidate();
      vi.advanceTimersByTime(9000);
      expect(actions.error.value).toBe('');
    }
  );
});
