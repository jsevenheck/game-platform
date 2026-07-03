/**
 * Shared party-authorization and host-sync helpers for game server modules.
 *
 * Every game's `autoJoinRoom` handler MUST validate the platform `joinToken`
 * against the party store and derive host identity from `party.hostPlayerId`
 * rather than trusting client-supplied `isHost` flags. This module centralizes
 * that contract so all games behave consistently (Scout was the original
 * reference implementation).
 *
 * @see CLAUDE.md — "autoJoinRoom socket event — … validates the platform
 *   joinToken, and syncs host identity from party state"
 */

import { getPartyByActiveMatch } from './partyStore';
import type { PartyMember, PartySession } from './types';

/**
 * Minimal structural view of a game room that the host-sync helpers need.
 * Every game's `Room` type satisfies this via TypeScript structural typing:
 * it requires `code`, `ownerId`, `hostId`, and a `players` record whose values
 * expose `id`, `connected` and `isHost`. Games that maintain an explicit
 * `playerOrder` array (Scout) get deterministic fallback-host selection; games
 * without it fall back to `Object.keys(room.players)`.
 */
export interface GameRoomLike {
  code: string;
  ownerId: string | null;
  hostId: string | null;
  players: Record<string, { id: string; connected: boolean; isHost: boolean }>;
  /** Optional explicit turn/order list (e.g. Scout's `playerOrder`). */
  playerOrder?: string[];
}

export interface AuthorizePartyJoinSuccess {
  ok: true;
  /** The party member that authorized the join — use its `playerId`/`name`. */
  member: PartyMember;
  /** The full party session (rarely needed directly). */
  party: PartySession;
  /** Authoritative platform host player id for host-sync. */
  hostPlayerId: string;
  /** Whether the platform host is currently connected to the party. */
  hostConnected: boolean;
  /** Whether the joining player IS the platform host. */
  isHost: boolean;
}

export interface AuthorizePartyJoinFailure {
  ok: false;
  error: string;
  reason: 'missing_player_id' | 'match_not_found' | 'member_not_found' | 'invalid_join_token';
}

export type AuthorizePartyJoinResult = AuthorizePartyJoinSuccess | AuthorizePartyJoinFailure;

/**
 * Validate that a game-join request is backed by an active platform party
 * match and that the supplied `joinToken` matches the party member's
 * `resumeToken`. On success, returns the authoritative member identity and
 * party host info — callers MUST use these instead of client-supplied
 * `playerId`/`name`/`isHost`.
 *
 * The party must be in `in-match` status with an `activeMatch` whose
 * `matchKey` matches and (when `gameId` is provided) whose `gameId` matches.
 */
export function authorizePartyJoin(
  gameId: string,
  matchKey: string,
  playerId: string | null,
  joinToken: string | null
): AuthorizePartyJoinResult {
  if (!playerId) {
    return { ok: false, error: 'Missing player info', reason: 'missing_player_id' };
  }

  const party = getPartyByActiveMatch(matchKey, gameId);
  if (!party) {
    return { ok: false, error: 'Match not found', reason: 'match_not_found' };
  }

  const member = party.members.get(playerId);
  if (!member) {
    return { ok: false, error: 'Not authorized for this match', reason: 'member_not_found' };
  }

  if (!joinToken || member.resumeToken !== joinToken) {
    return { ok: false, error: 'Not authorized for this match', reason: 'invalid_join_token' };
  }

  const hostMember = party.members.get(party.hostPlayerId);

  return {
    ok: true,
    member,
    party,
    hostPlayerId: party.hostPlayerId,
    hostConnected: hostMember?.connected ?? false,
    isHost: party.hostPlayerId === playerId,
  };
}

/**
 * Normalize a join-token value that may come from either the event payload or
 * the socket handshake auth. Returns `null` for missing/blank values so
 * `authorizePartyJoin` rejects them uniformly.
 */
export function normalizeJoinToken(payloadValue: unknown, socketValue: unknown): string | null {
  const value = typeof payloadValue === 'string' ? payloadValue : socketValue;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Normalize a client-supplied stable player id. Returns `null` for
 * missing/blank/non-string values.
 */
export function normalizeStablePlayerId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

// ─── Host-sync helpers ───────────────────────────────────────────────────────

/**
 * Assign the game host role to `newHostId`, clearing it from every other
 * player. No-op if the target player does not exist.
 */
export function assignHost(room: GameRoomLike, newHostId: string): void {
  const nextHost = room.players[newHostId];
  if (!nextHost) return;
  for (const player of Object.values(room.players)) {
    player.isHost = player.id === newHostId;
  }
  room.hostId = newHostId;
}

/** Clear the host flag from every player and null out `hostId`. */
export function clearHost(room: GameRoomLike): void {
  for (const player of Object.values(room.players)) {
    player.isHost = false;
  }
  room.hostId = null;
}

/** Whether `playerId` refers to a currently-connected player in `room`. */
export function isConnectedPlayer(
  room: GameRoomLike,
  playerId: string | null | undefined
): boolean {
  return !!playerId && room.players[playerId]?.connected === true;
}

/**
 * If the current host is missing or disconnected, pick the first connected
 * player (respecting `playerOrder` when present) as the fallback host.
 * Returns `true` when a new host was assigned. Clears host state if nobody is
 * connected.
 */
export function restoreHostToFirstConnectedPlayer(room: GameRoomLike): boolean {
  if (isConnectedPlayer(room, room.hostId)) return false;

  const candidateIds = room.playerOrder ?? Object.keys(room.players);
  const nextHostId = candidateIds.find((playerId) => room.players[playerId]?.connected);
  if (!nextHostId) {
    clearHost(room);
    return false;
  }
  assignHost(room, nextHostId);
  return true;
}

/**
 * Sync the game room's host/owner to the platform party host. Sets `ownerId`
 * to the platform host; if that host is connected in the game room, makes them
 * the game host; otherwise falls back to the first connected player.
 */
export function syncRoomHostFromParty(room: GameRoomLike, hostPlayerId: string): void {
  room.ownerId = hostPlayerId;
  if (isConnectedPlayer(room, hostPlayerId)) {
    assignHost(room, hostPlayerId);
    return;
  }
  restoreHostToFirstConnectedPlayer(room);
}

/**
 * Sync host identity after a player joins. Always syncs from the platform
 * host; when `allowFallbackHost` is true (e.g. the platform host isn't
 * connected to the party yet) or the synced host isn't connected in the game
 * room, additionally restores a fallback host so the room is never host-less.
 */
export function syncRoomHostAfterJoin(
  room: GameRoomLike,
  hostPlayerId: string,
  allowFallbackHost: boolean
): void {
  syncRoomHostFromParty(room, hostPlayerId);
  if (allowFallbackHost || !isConnectedPlayer(room, room.hostId)) {
    restoreHostToFirstConnectedPlayer(room);
  }
}
