import type { Server } from 'socket.io';
import { getAllParties, isJoinablePublicParty, connectedMemberCount } from './partyStore';
import type { PartySession } from './types';
import { getGame } from '../registry/index';

/**
 * Server-side room that receives `joinablePartiesUpdate` snapshots.
 * Anyone subscribed to the live-rooms feed joins this Socket.IO room.
 */
export const PUBLIC_LOBBIES_ROOM = 'public-lobbies-watchers';

/**
 * Public, joinable lobby wire view. Exposed only for host-opted-in lobbies.
 * Intentionally excludes host/member identity, socket ids, party ids, and tokens.
 */
export interface JoinablePartyView {
  inviteCode: string;
  gameId: string | null;
  gameName: string | null;
  minPlayers: number | null;
  maxPlayers: number | null;
  connectedPlayers: number;
  status: 'lobby';
  listedAt: number;
}

function toJoinablePartyView(party: PartySession): JoinablePartyView {
  const game = party.selectedGameId ? getGame(party.selectedGameId) : undefined;
  return {
    inviteCode: party.inviteCode,
    gameId: party.selectedGameId,
    gameName: game?.definition.name ?? null,
    minPlayers: game?.definition.minPlayers ?? null,
    maxPlayers: game?.definition.maxPlayers ?? null,
    connectedPlayers: connectedMemberCount(party),
    status: 'lobby',
    listedAt: party.publicListedAt ?? 0,
  };
}

/**
 * Full snapshot of currently public, joinable lobbies, newest-first.
 * Full snapshots are simpler and safer than diffs at this scale.
 */
export function getJoinablePublicPartiesSnapshot(): JoinablePartyView[] {
  return getAllParties()
    .filter(isJoinablePublicParty)
    .map(toJoinablePartyView)
    .sort((a, b) => b.listedAt - a.listedAt);
}

/**
 * Push the current public-lobby snapshot to all watchers.
 * Call after any mutation that can change the snapshot.
 */
export function broadcastJoinableParties(io: Server): void {
  const parties = getJoinablePublicPartiesSnapshot();
  io.of('/party').to(PUBLIC_LOBBIES_ROOM).emit('joinablePartiesUpdate', parties);
}
