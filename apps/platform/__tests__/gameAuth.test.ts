import {
  assignHost,
  authorizePartyJoin,
  clearHost,
  isConnectedPlayer,
  normalizeJoinToken,
  normalizeStablePlayerId,
  readArrayIndex,
  readFiniteNumber,
  readString,
  restoreHostToFirstConnectedPlayer,
  syncRoomHostAfterJoin,
  syncRoomHostFromParty,
  type GameRoomLike,
} from '../server/party/gameAuth';
import { createParty, clearAllParties } from '../server/party/partyStore';

// gameAuth.ts is the single shared module every game's join-authorization
// and host-derivation logic depends on (see CLAUDE.md's autoJoinRoom
// contract). It previously had no dedicated unit test of its own — every
// game only exercised it indirectly through its own integration tests.

describe('gameAuth', () => {
  afterEach(() => {
    clearAllParties();
  });

  function makeRoom(overrides: Partial<GameRoomLike> = {}): GameRoomLike {
    return {
      code: 'ROOM1',
      ownerId: null,
      hostId: null,
      players: {},
      ...overrides,
    };
  }

  function addPlayer(room: GameRoomLike, id: string, connected: boolean, isHost = false): void {
    room.players[id] = { id, connected, isHost };
  }

  // ────────────────────────────────────────────────────────────────
  // authorizePartyJoin
  // ────────────────────────────────────────────────────────────────

  describe('authorizePartyJoin', () => {
    it('rejects with missing_player_id when playerId is null', () => {
      const result = authorizePartyJoin('test-game', 'match-1', null, 'token');
      expect(result).toEqual({
        ok: false,
        error: 'Missing player info',
        reason: 'missing_player_id',
      });
    });

    it('rejects with match_not_found when no active party matches', () => {
      const result = authorizePartyJoin('test-game', 'no-such-match', 'p1', 'token');
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toBe('match_not_found');
    });

    it('rejects with member_not_found when the party exists but the player is not a member', () => {
      const { party } = createParty('host-1', 'Host', 'sock-1');
      party.status = 'in-match';
      party.activeMatch = {
        gameId: 'test-game',
        matchKey: 'match-2',
        namespace: '/g/test-game',
        startedAt: Date.now(),
      };

      const result = authorizePartyJoin('test-game', 'match-2', 'stranger', 'token');
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toBe('member_not_found');
    });

    it('rejects with invalid_join_token for a missing or wrong token', () => {
      const { party, hostResumeToken } = createParty('host-1', 'Host', 'sock-1');
      party.status = 'in-match';
      party.activeMatch = {
        gameId: 'test-game',
        matchKey: 'match-3',
        namespace: '/g/test-game',
        startedAt: Date.now(),
      };

      expect(authorizePartyJoin('test-game', 'match-3', 'host-1', null)).toEqual({
        ok: false,
        error: 'Not authorized for this match',
        reason: 'invalid_join_token',
      });
      expect(authorizePartyJoin('test-game', 'match-3', 'host-1', 'wrong-token')).toEqual({
        ok: false,
        error: 'Not authorized for this match',
        reason: 'invalid_join_token',
      });
      // Sanity: the real token does succeed.
      expect(authorizePartyJoin('test-game', 'match-3', 'host-1', hostResumeToken).ok).toBe(true);
    });

    it('succeeds and returns the authoritative member/party/host info', () => {
      const { party, hostResumeToken } = createParty('host-1', 'Host', 'sock-1');
      party.status = 'in-match';
      party.activeMatch = {
        gameId: 'test-game',
        matchKey: 'match-4',
        namespace: '/g/test-game',
        startedAt: Date.now(),
      };

      const result = authorizePartyJoin('test-game', 'match-4', 'host-1', hostResumeToken);
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('expected success');
      expect(result.member.playerId).toBe('host-1');
      expect(result.member.name).toBe('Host');
      expect(result.hostPlayerId).toBe('host-1');
      expect(result.hostConnected).toBe(true);
      expect(result.isHost).toBe(true);
    });

    it('reports isHost: false and the correct hostConnected for a non-host member', () => {
      const { party, hostResumeToken } = createParty('host-1', 'Host', 'sock-1');
      const guestToken = 'guest-token';
      party.members.set('guest-1', {
        playerId: 'guest-1',
        name: 'Guest',
        connected: true,
        socketId: 'sock-2',
        resumeToken: guestToken,
      });
      party.status = 'in-match';
      party.activeMatch = {
        gameId: 'test-game',
        matchKey: 'match-5',
        namespace: '/g/test-game',
        startedAt: Date.now(),
      };
      // Host has since disconnected from the party namespace.
      party.members.get('host-1')!.connected = false;

      const result = authorizePartyJoin('test-game', 'match-5', 'guest-1', guestToken);
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('expected success');
      expect(result.isHost).toBe(false);
      expect(result.hostPlayerId).toBe('host-1');
      expect(result.hostConnected).toBe(false);
      void hostResumeToken;
    });

    it('rejects when the matchKey belongs to a different gameId', () => {
      const { party, hostResumeToken } = createParty('host-1', 'Host', 'sock-1');
      party.status = 'in-match';
      party.activeMatch = {
        gameId: 'other-game',
        matchKey: 'match-6',
        namespace: '/g/other-game',
        startedAt: Date.now(),
      };

      const result = authorizePartyJoin('test-game', 'match-6', 'host-1', hostResumeToken);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toBe('match_not_found');
    });
  });

  // ────────────────────────────────────────────────────────────────
  // normalizeJoinToken / normalizeStablePlayerId
  // ────────────────────────────────────────────────────────────────

  describe('normalizeJoinToken', () => {
    it('prefers the payload value when it is a non-blank string', () => {
      expect(normalizeJoinToken('  from-payload  ', 'from-socket')).toBe('from-payload');
    });

    it('falls back to the socket value when the payload value is not a string', () => {
      expect(normalizeJoinToken(12345, 'from-socket')).toBe('from-socket');
      expect(normalizeJoinToken(undefined, 'from-socket')).toBe('from-socket');
    });

    it('returns null when neither value is a usable string', () => {
      expect(normalizeJoinToken(undefined, undefined)).toBeNull();
      expect(normalizeJoinToken('   ', '   ')).toBeNull();
      expect(normalizeJoinToken(42, {})).toBeNull();
    });
  });

  describe('normalizeStablePlayerId', () => {
    it('trims a valid string', () => {
      expect(normalizeStablePlayerId('  player-1  ')).toBe('player-1');
    });

    it('returns null for non-string or blank values', () => {
      expect(normalizeStablePlayerId(123)).toBeNull();
      expect(normalizeStablePlayerId(null)).toBeNull();
      expect(normalizeStablePlayerId('   ')).toBeNull();
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Payload-shape helpers (F1 root-cause fix)
  // ────────────────────────────────────────────────────────────────

  describe('readString', () => {
    it('returns the value only when it is a string', () => {
      expect(readString('hello')).toBe('hello');
      expect(readString('')).toBe('');
    });

    it('returns undefined for every non-string type', () => {
      for (const value of [123, null, undefined, {}, [], true, NaN]) {
        expect(readString(value)).toBeUndefined();
      }
    });
  });

  describe('readFiniteNumber', () => {
    it('returns the value only when it is a finite number', () => {
      expect(readFiniteNumber(42)).toBe(42);
      expect(readFiniteNumber(0)).toBe(0);
      expect(readFiniteNumber(-3.5)).toBe(-3.5);
    });

    it('rejects NaN, Infinity, and non-number types', () => {
      for (const value of [NaN, Infinity, -Infinity, '42', null, undefined, {}, []]) {
        expect(readFiniteNumber(value)).toBeUndefined();
      }
    });
  });

  describe('readArrayIndex', () => {
    it('returns the value only for a non-negative integer', () => {
      expect(readArrayIndex(0)).toBe(0);
      expect(readArrayIndex(24)).toBe(24);
    });

    it('rejects negative numbers, non-integers, and non-numbers', () => {
      for (const value of [-1, 1.5, '3', null, undefined, {}, NaN]) {
        expect(readArrayIndex(value)).toBeUndefined();
      }
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Host-sync helpers
  // ────────────────────────────────────────────────────────────────

  describe('assignHost', () => {
    it('sets hostId and flips isHost on exactly the target player', () => {
      const room = makeRoom();
      addPlayer(room, 'p1', true, true);
      addPlayer(room, 'p2', true, false);

      assignHost(room, 'p2');

      expect(room.hostId).toBe('p2');
      expect(room.players.p1!.isHost).toBe(false);
      expect(room.players.p2!.isHost).toBe(true);
    });

    it('is a no-op when the target player does not exist in the room', () => {
      const room = makeRoom({ hostId: 'p1' });
      addPlayer(room, 'p1', true, true);

      assignHost(room, 'ghost');

      expect(room.hostId).toBe('p1');
      expect(room.players.p1!.isHost).toBe(true);
    });
  });

  describe('clearHost', () => {
    it('nulls hostId and clears isHost on every player', () => {
      const room = makeRoom({ hostId: 'p1' });
      addPlayer(room, 'p1', true, true);
      addPlayer(room, 'p2', true, false);

      clearHost(room);

      expect(room.hostId).toBeNull();
      expect(room.players.p1!.isHost).toBe(false);
      expect(room.players.p2!.isHost).toBe(false);
    });
  });

  describe('isConnectedPlayer', () => {
    it('is true only for a connected player in the room', () => {
      const room = makeRoom();
      addPlayer(room, 'p1', true);
      addPlayer(room, 'p2', false);

      expect(isConnectedPlayer(room, 'p1')).toBe(true);
      expect(isConnectedPlayer(room, 'p2')).toBe(false);
      expect(isConnectedPlayer(room, 'ghost')).toBe(false);
      expect(isConnectedPlayer(room, null)).toBe(false);
      expect(isConnectedPlayer(room, undefined)).toBe(false);
    });
  });

  describe('restoreHostToFirstConnectedPlayer', () => {
    it('does nothing and returns false when the current host is already connected', () => {
      const room = makeRoom({ hostId: 'p1' });
      addPlayer(room, 'p1', true, true);

      expect(restoreHostToFirstConnectedPlayer(room)).toBe(false);
      expect(room.hostId).toBe('p1');
    });

    it('promotes the first connected player (by Object.keys order) when the host is disconnected', () => {
      const room = makeRoom({ hostId: 'p1' });
      addPlayer(room, 'p1', false, true);
      addPlayer(room, 'p2', false);
      addPlayer(room, 'p3', true);

      expect(restoreHostToFirstConnectedPlayer(room)).toBe(true);
      expect(room.hostId).toBe('p3');
      expect(room.players.p3!.isHost).toBe(true);
    });

    it('respects an explicit playerOrder over object key order', () => {
      const room = makeRoom({ hostId: 'p1', playerOrder: ['p3', 'p2', 'p1'] });
      addPlayer(room, 'p1', false, true);
      addPlayer(room, 'p2', true);
      addPlayer(room, 'p3', false);

      restoreHostToFirstConnectedPlayer(room);

      expect(room.hostId).toBe('p2');
    });

    it('clears the host entirely when nobody is connected', () => {
      const room = makeRoom({ hostId: 'p1' });
      addPlayer(room, 'p1', false, true);
      addPlayer(room, 'p2', false);

      expect(restoreHostToFirstConnectedPlayer(room)).toBe(false);
      expect(room.hostId).toBeNull();
      expect(room.players.p1!.isHost).toBe(false);
    });
  });

  describe('syncRoomHostFromParty', () => {
    it('sets ownerId and makes the party host the room host when they are connected', () => {
      const room = makeRoom();
      addPlayer(room, 'p1', true);

      syncRoomHostFromParty(room, 'p1');

      expect(room.ownerId).toBe('p1');
      expect(room.hostId).toBe('p1');
    });

    it('sets ownerId to the party host even when they are not connected, and falls back for hostId', () => {
      const room = makeRoom();
      addPlayer(room, 'p1', false); // party host, not connected to this game
      addPlayer(room, 'p2', true);

      syncRoomHostFromParty(room, 'p1');

      expect(room.ownerId).toBe('p1');
      expect(room.hostId).toBe('p2');
    });
  });

  describe('syncRoomHostAfterJoin', () => {
    it('makes the connected party host the room host without touching allowFallbackHost', () => {
      const room = makeRoom();
      addPlayer(room, 'p1', true);
      addPlayer(room, 'p2', true);

      syncRoomHostAfterJoin(room, 'p1', false);

      expect(room.hostId).toBe('p1');
    });

    it('falls back to a connected player when allowFallbackHost is true, even if the party host is connected here', () => {
      // e.g. the platform host hasn't joined this game's namespace yet.
      const room = makeRoom();
      addPlayer(room, 'p2', true);
      // p1 (the party host) has no entry in room.players at all yet.

      syncRoomHostAfterJoin(room, 'p1', true);

      expect(room.ownerId).toBe('p1');
      expect(room.hostId).toBe('p2');
    });

    it('leaves the room host-less when nobody is connected', () => {
      const room = makeRoom();
      addPlayer(room, 'p1', false);

      syncRoomHostAfterJoin(room, 'p1', false);

      expect(room.hostId).toBeNull();
    });
  });
});
