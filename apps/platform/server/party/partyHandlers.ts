import type { Server, Socket } from 'socket.io';
import { nanoid } from 'nanoid';
import {
  createParty,
  getPartyByInviteCode,
  getPartyBySocket,
  partyToView,
  registerSocket,
  unregisterSocket,
  deleteParty,
} from './partyStore';
import type { PartySession } from './types';
import { getGame } from '../registry/index';

interface PartyClientToServerEvents {
  createParty: (
    data: { playerName: string },
    cb: (
      res:
        | {
            ok: true;
            partyView: ReturnType<typeof partyToView>;
            playerId: string;
            resumeToken: string;
          }
        | { ok: false; error: string }
    ) => void
  ) => void;
  joinParty: (
    data: { inviteCode: string; playerName: string },
    cb: (
      res:
        | {
            ok: true;
            partyView: ReturnType<typeof partyToView>;
            playerId: string;
            resumeToken: string;
          }
        | { ok: false; error: string }
    ) => void
  ) => void;
  resumeParty: (
    data: { inviteCode: string; playerId: string; resumeToken: string },
    cb: (
      res: { ok: true; partyView: ReturnType<typeof partyToView> } | { ok: false; error: string }
    ) => void
  ) => void;
  leaveParty: (data: { playerId: string }) => void;
  selectGame: (
    data: { playerId: string; gameId: string },
    cb: (res: { ok: true } | { ok: false; error: string }) => void
  ) => void;
  launchGame: (
    data: { playerId: string },
    cb: (res: { ok: true } | { ok: false; error: string }) => void
  ) => void;
  replayGame: (
    data: { playerId: string },
    cb: (res: { ok: true } | { ok: false; error: string }) => void
  ) => void;
  returnToLobby: (
    data: { playerId: string },
    cb: (res: { ok: true } | { ok: false; error: string }) => void
  ) => void;
  ackReturnedToLobby: (data: { playerId: string }) => void;
}

interface PartyServerToClientEvents {
  partyUpdate: (partyView: ReturnType<typeof partyToView>) => void;
  partyError: (message: string) => void;
}

type PartySocket = Socket<PartyClientToServerEvents, PartyServerToClientEvents>;

function broadcastParty(io: Server, party: PartySession): void {
  io.of('/party').to(party.partyId).emit('partyUpdate', partyToView(party));
}

function connectedMemberCount(party: PartySession): number {
  return Array.from(party.members.values()).filter((m) => m.connected).length;
}

export function registerPartyHandlers(io: Server): void {
  const nsp = io.of('/party');

  nsp.on('connection', (socket: PartySocket) => {
    socket.on('createParty', (data, cb) => {
      const name = data.playerName?.trim();
      if (!name || name.length > 20) {
        return cb({ ok: false, error: 'Invalid player name' });
      }

      const playerId = nanoid(8);
      const { party, hostResumeToken } = createParty(playerId, name, socket.id);
      socket.join(party.partyId);

      cb({ ok: true, partyView: partyToView(party), playerId, resumeToken: hostResumeToken });
    });

    socket.on('joinParty', (data, cb) => {
      const name = data.playerName?.trim();
      const inviteCode = data.inviteCode?.trim().toUpperCase();
      if (!name || name.length > 20) {
        return cb({ ok: false, error: 'Invalid player name' });
      }

      const party = getPartyByInviteCode(inviteCode);
      if (!party) {
        return cb({ ok: false, error: 'Party not found' });
      }
      if (party.status !== 'lobby') {
        return cb({ ok: false, error: 'Party is already in a match' });
      }

      const nameExists = Array.from(party.members.values()).some(
        (m) => m.name.toLowerCase() === name.toLowerCase()
      );
      if (nameExists) {
        return cb({ ok: false, error: 'Name already taken' });
      }

      const playerId = nanoid(8);
      const memberResumeToken = nanoid(24);
      party.members.set(playerId, {
        playerId,
        name,
        connected: true,
        socketId: socket.id,
        resumeToken: memberResumeToken,
      });

      registerSocket(socket.id, party.partyId);
      socket.join(party.partyId);
      broadcastParty(io, party);

      cb({ ok: true, partyView: partyToView(party), playerId, resumeToken: memberResumeToken });
    });

    socket.on('resumeParty', (data, cb) => {
      const inviteCode = data.inviteCode?.trim().toUpperCase();
      const playerId = data.playerId?.trim();

      const party = getPartyByInviteCode(inviteCode);
      if (!party) {
        return cb({ ok: false, error: 'Party not found' });
      }

      const member = party.members.get(playerId);
      if (!member) {
        return cb({ ok: false, error: 'Player not in party' });
      }

      // Verify server-issued resume token — prevents session hijacking via public playerId.
      if (member.resumeToken !== data.resumeToken) {
        return cb({ ok: false, error: 'Invalid resume token' });
      }

      // Update socket binding
      if (member.socketId) {
        unregisterSocket(member.socketId);
      }
      member.socketId = socket.id;
      member.connected = true;
      registerSocket(socket.id, party.partyId);
      socket.join(party.partyId);
      broadcastParty(io, party);

      cb({ ok: true, partyView: partyToView(party) });
    });

    socket.on('leaveParty', (data) => {
      const party = getPartyBySocket(socket.id);
      if (!party) return;

      const member = party.members.get(data.playerId);
      if (!member || member.socketId !== socket.id) return;

      party.members.delete(data.playerId);
      unregisterSocket(socket.id);
      socket.leave(party.partyId);

      // Transfer host if needed
      if (party.hostPlayerId === data.playerId) {
        const nextMember = Array.from(party.members.values()).find((m) => m.connected);
        if (nextMember) {
          party.hostPlayerId = nextMember.playerId;
        } else {
          deleteParty(party.partyId);
          return;
        }
      }

      if (party.members.size === 0) {
        deleteParty(party.partyId);
        return;
      }

      broadcastParty(io, party);
    });

    socket.on('selectGame', (data, cb) => {
      const party = getPartyBySocket(socket.id);
      if (!party) return cb({ ok: false, error: 'Not in a party' });
      const actor = Array.from(party.members.values()).find((m) => m.socketId === socket.id);
      if (!actor || actor.playerId !== party.hostPlayerId) {
        return cb({ ok: false, error: 'Only the host can select a game' });
      }
      if (!getGame(data.gameId)) {
        return cb({ ok: false, error: 'Unknown game' });
      }

      party.selectedGameId = data.gameId;
      broadcastParty(io, party);
      cb({ ok: true });
    });

    socket.on('launchGame', (data, cb) => {
      const party = getPartyBySocket(socket.id);
      if (!party) return cb({ ok: false, error: 'Not in a party' });
      const actor = Array.from(party.members.values()).find((m) => m.socketId === socket.id);
      if (!actor || actor.playerId !== party.hostPlayerId) {
        return cb({ ok: false, error: 'Only the host can launch a game' });
      }
      if (!party.selectedGameId) {
        return cb({ ok: false, error: 'No game selected' });
      }
      if (party.status !== 'lobby') {
        return cb({ ok: false, error: 'Party is not in lobby' });
      }

      const game = getGame(party.selectedGameId);
      if (!game) return cb({ ok: false, error: 'Game not found' });

      const connected = connectedMemberCount(party);
      if (connected < game.definition.minPlayers) {
        return cb({
          ok: false,
          error: `Need at least ${game.definition.minPlayers} players (have ${connected})`,
        });
      }
      if (connected > game.definition.maxPlayers) {
        return cb({
          ok: false,
          error: `Too many players (max ${game.definition.maxPlayers})`,
        });
      }

      const matchKey = nanoid(16);
      const namespace = `/g/${party.selectedGameId}`;

      party.activeMatch = {
        gameId: party.selectedGameId,
        matchKey,
        namespace,
        startedAt: Date.now(),
      };
      party.status = 'in-match';
      party.pendingCleanupMatchKey = null;

      broadcastParty(io, party);
      cb({ ok: true });
    });

    socket.on('replayGame', (data, cb) => {
      const party = getPartyBySocket(socket.id);
      if (!party) return cb({ ok: false, error: 'Not in a party' });
      const actor = Array.from(party.members.values()).find((m) => m.socketId === socket.id);
      if (!actor || actor.playerId !== party.hostPlayerId) {
        return cb({ ok: false, error: 'Only the host can replay' });
      }
      if (party.status !== 'in-match' || !party.activeMatch) {
        return cb({ ok: false, error: 'No active match to replay' });
      }

      const game = getGame(party.activeMatch.gameId);
      if (!game) return cb({ ok: false, error: 'Game not found' });

      const connected = connectedMemberCount(party);
      if (connected < game.definition.minPlayers) {
        return cb({
          ok: false,
          error: `Need at least ${game.definition.minPlayers} players`,
        });
      }

      const previousMatchKey = party.activeMatch.matchKey;
      const newMatchKey = nanoid(16);

      party.pendingCleanupMatchKey = previousMatchKey;
      party.activeMatch = {
        gameId: party.activeMatch.gameId,
        matchKey: newMatchKey,
        namespace: party.activeMatch.namespace,
        startedAt: Date.now(),
      };
      // status stays 'in-match'

      broadcastParty(io, party);

      // Cleanup the old match after a brief delay to allow all clients to transition
      setTimeout(() => {
        try {
          game.cleanupMatch(previousMatchKey);
        } catch {
          // Cleanup is best-effort
        }
        if (party.pendingCleanupMatchKey === previousMatchKey) {
          party.pendingCleanupMatchKey = null;
        }
      }, 5000);

      cb({ ok: true });
    });

    socket.on('returnToLobby', (data, cb) => {
      const party = getPartyBySocket(socket.id);
      if (!party) return cb({ ok: false, error: 'Not in a party' });
      const actor = Array.from(party.members.values()).find((m) => m.socketId === socket.id);
      if (!actor || actor.playerId !== party.hostPlayerId) {
        return cb({ ok: false, error: 'Only the host can return to lobby' });
      }
      if (!party.activeMatch) {
        return cb({ ok: false, error: 'No active match' });
      }

      const matchToClean = party.activeMatch;
      party.activeMatch = null;
      party.status = 'returning';
      party.returnAcks = new Set();

      broadcastParty(io, party);
      cb({ ok: true });

      // If all members already connected acknowledge promptly, transition to lobby
      const game = getGame(matchToClean.gameId);
      scheduleReturnCleanup(io, party, matchToClean.matchKey, game?.cleanupMatch);
    });

    socket.on('ackReturnedToLobby', (data) => {
      const party = getPartyBySocket(socket.id);
      if (!party || party.status !== 'returning') return;

      const member = party.members.get(data.playerId);
      if (member) {
        party.returnAcks.add(data.playerId);
      }

      const connected = Array.from(party.members.values())
        .filter((m) => m.connected)
        .map((m) => m.playerId);

      const allAcked = connected.every((id) => party.returnAcks.has(id));
      if (allAcked && party.status === 'returning') {
        party.status = 'lobby';
        party.returnAcks = new Set();
        broadcastParty(io, party);
      }
    });

    socket.on('disconnect', () => {
      const party = getPartyBySocket(socket.id);
      if (!party) return;

      unregisterSocket(socket.id);

      const member = Array.from(party.members.values()).find((m) => m.socketId === socket.id);
      if (member) {
        member.connected = false;
        member.socketId = null;
      }

      broadcastParty(io, party);
    });
  });
}

function scheduleReturnCleanup(
  io: Server,
  party: PartySession,
  matchKey: string,
  cleanupFn?: (key: string) => void
): void {
  // Wait for acks or a timeout before finalizing lobby status and cleaning up
  setTimeout(() => {
    if (party.status === 'returning') {
      party.status = 'lobby';
      party.returnAcks = new Set();
      broadcastParty(io, party);
    }
    if (cleanupFn) {
      try {
        cleanupFn(matchKey);
      } catch {
        // Cleanup is best-effort
      }
    }
  }, 10000);
}
