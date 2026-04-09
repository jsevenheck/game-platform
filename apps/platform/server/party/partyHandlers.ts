import type { Logger } from 'pino';
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
  schedulePartyCleanup,
  clearPartyCleanup,
  scheduleMatchTimeout,
  clearMatchTimeout,
} from './partyStore';
import type { PartySession } from './types';
import { createComponentLogger, readLoggingConfig, toLoggableError } from '../logging/logger';
import { attachSocketEventDebugLogging, createSocketLogger } from '../logging/socketLogger';
import { incrementPartyLifecycle } from '../metrics/metrics';
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
  const partyLogger = createComponentLogger('party', { namespace: '/party' });
  const socketEventDebugEnabled = readLoggingConfig().socketEvents;

  function triggerMatchTimeout(party: PartySession): void {
    if (party.status !== 'in-match' || !party.activeMatch) return;

    const matchToClean = party.activeMatch;
    party.activeMatch = null;
    party.status = 'returning';
    party.returnAcks = new Set();

    broadcastParty(io, party);

    const game = getGame(matchToClean.gameId);
    partyLogger.warn(
      {
        partyId: party.partyId,
        inviteCode: party.inviteCode,
        gameId: matchToClean.gameId,
        matchKey: matchToClean.matchKey,
      },
      'match timed out; returning party to lobby'
    );
    scheduleReturnCleanup(io, party, matchToClean.matchKey, game?.cleanupMatch, partyLogger);
  }

  nsp.on('connection', (socket: PartySocket) => {
    const socketLogger = createSocketLogger(partyLogger, socket);

    attachSocketEventDebugLogging(socket, socketLogger, socketEventDebugEnabled);
    socketLogger.debug('party client connected');

    socket.on('createParty', (data, cb) => {
      const name = data.playerName?.trim();
      if (!name || name.length > 20) {
        incrementPartyLifecycle({ event: 'createParty', result: 'error', reason: 'invalid_name' });
        return cb({ ok: false, error: 'Invalid player name' });
      }

      const playerId = nanoid(8);
      const { party, hostResumeToken } = createParty(playerId, name, socket.id);
      socket.join(party.partyId);

      socketLogger.info(
        {
          partyId: party.partyId,
          inviteCode: party.inviteCode,
          playerId,
          playerName: name,
        },
        'party created'
      );
      incrementPartyLifecycle({ event: 'createParty', result: 'ok' });

      cb({ ok: true, partyView: partyToView(party), playerId, resumeToken: hostResumeToken });
    });

    socket.on('joinParty', (data, cb) => {
      const name = data.playerName?.trim();
      const inviteCode = data.inviteCode?.trim().toUpperCase();
      if (!name || name.length > 20) {
        incrementPartyLifecycle({ event: 'joinParty', result: 'error', reason: 'invalid_name' });
        return cb({ ok: false, error: 'Invalid player name' });
      }

      const party = getPartyByInviteCode(inviteCode);
      if (!party) {
        socketLogger.warn({ inviteCode }, 'joinParty rejected: party not found');
        incrementPartyLifecycle({ event: 'joinParty', result: 'error', reason: 'party_not_found' });
        return cb({ ok: false, error: 'Party not found' });
      }
      if (party.status !== 'lobby') {
        incrementPartyLifecycle({ event: 'joinParty', result: 'error', reason: 'party_not_lobby' });
        return cb({ ok: false, error: 'Party is already in a match' });
      }

      const nameExists = Array.from(party.members.values()).some(
        (m) => m.name.toLowerCase() === name.toLowerCase()
      );
      if (nameExists) {
        incrementPartyLifecycle({ event: 'joinParty', result: 'error', reason: 'name_taken' });
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
      clearPartyCleanup(party.partyId);
      socket.join(party.partyId);
      broadcastParty(io, party);

      socketLogger.info(
        {
          partyId: party.partyId,
          inviteCode: party.inviteCode,
          playerId,
          playerName: name,
          memberCount: party.members.size,
        },
        'player joined party'
      );
      incrementPartyLifecycle({ event: 'joinParty', result: 'ok' });

      cb({ ok: true, partyView: partyToView(party), playerId, resumeToken: memberResumeToken });
    });

    socket.on('resumeParty', (data, cb) => {
      const inviteCode = data.inviteCode?.trim().toUpperCase();
      const playerId = data.playerId?.trim();

      const party = getPartyByInviteCode(inviteCode);
      if (!party) {
        socketLogger.warn({ inviteCode, playerId }, 'resumeParty rejected: party not found');
        incrementPartyLifecycle({
          event: 'resumeParty',
          result: 'error',
          reason: 'party_not_found',
        });
        return cb({ ok: false, error: 'Party not found' });
      }

      const member = party.members.get(playerId);
      if (!member) {
        incrementPartyLifecycle({
          event: 'resumeParty',
          result: 'error',
          reason: 'member_not_found',
        });
        return cb({ ok: false, error: 'Player not in party' });
      }

      if (member.resumeToken !== data.resumeToken) {
        socketLogger.warn(
          {
            partyId: party.partyId,
            inviteCode: party.inviteCode,
            playerId,
          },
          'resumeParty rejected: invalid resume token'
        );
        incrementPartyLifecycle({ event: 'resumeParty', result: 'error', reason: 'invalid_token' });
        return cb({ ok: false, error: 'Invalid resume token' });
      }

      if (member.socketId) {
        unregisterSocket(member.socketId);
      }
      member.socketId = socket.id;
      member.connected = true;
      registerSocket(socket.id, party.partyId);
      clearPartyCleanup(party.partyId);
      socket.join(party.partyId);
      broadcastParty(io, party);

      socketLogger.info(
        {
          partyId: party.partyId,
          inviteCode: party.inviteCode,
          playerId,
        },
        'player resumed party session'
      );
      incrementPartyLifecycle({ event: 'resumeParty', result: 'ok' });

      cb({ ok: true, partyView: partyToView(party) });
    });

    socket.on('leaveParty', (data) => {
      const party = getPartyBySocket(socket.id);
      if (!party) return;

      const member = party.members.get(data.playerId);
      if (!member || member.socketId !== socket.id) return;

      party.members.delete(data.playerId);
      incrementPartyLifecycle({ event: 'leaveParty', result: 'ok' });
      unregisterSocket(socket.id);
      socket.leave(party.partyId);

      if (party.hostPlayerId === data.playerId) {
        const nextMember = Array.from(party.members.values()).find((m) => m.connected);
        if (nextMember) {
          party.hostPlayerId = nextMember.playerId;
          socketLogger.info(
            {
              partyId: party.partyId,
              inviteCode: party.inviteCode,
              previousHostPlayerId: data.playerId,
              nextHostPlayerId: nextMember.playerId,
            },
            'transferred host after leave'
          );
        } else {
          deleteParty(party.partyId);
          socketLogger.info(
            {
              partyId: party.partyId,
              inviteCode: party.inviteCode,
              playerId: data.playerId,
            },
            'deleted party after last host left'
          );
          return;
        }
      }

      if (party.members.size === 0) {
        deleteParty(party.partyId);
        socketLogger.info(
          {
            partyId: party.partyId,
            inviteCode: party.inviteCode,
            playerId: data.playerId,
          },
          'deleted empty party after leave'
        );
        return;
      }

      if (connectedMemberCount(party) === 0) {
        schedulePartyCleanup(party.partyId);
        partyLogger.info(
          {
            partyId: party.partyId,
            inviteCode: party.inviteCode,
          },
          'scheduled party cleanup after all players left'
        );
      }

      broadcastParty(io, party);
      socketLogger.info(
        {
          partyId: party.partyId,
          inviteCode: party.inviteCode,
          playerId: data.playerId,
          remainingMembers: party.members.size,
        },
        'player left party'
      );
    });

    socket.on('selectGame', (data, cb) => {
      const party = getPartyBySocket(socket.id);
      if (!party) return cb({ ok: false, error: 'Not in a party' });
      const actor = Array.from(party.members.values()).find((m) => m.socketId === socket.id);
      if (!actor || actor.playerId !== party.hostPlayerId) {
        socketLogger.warn(
          {
            partyId: party.partyId,
            inviteCode: party.inviteCode,
            playerId: actor?.playerId ?? data.playerId,
            gameId: data.gameId,
          },
          'selectGame rejected: actor is not party host'
        );
        return cb({ ok: false, error: 'Only the host can select a game' });
      }
      if (!getGame(data.gameId)) {
        return cb({ ok: false, error: 'Unknown game' });
      }

      party.selectedGameId = data.gameId;
      broadcastParty(io, party);
      socketLogger.info(
        {
          partyId: party.partyId,
          inviteCode: party.inviteCode,
          gameId: data.gameId,
        },
        'host selected game'
      );
      cb({ ok: true });
    });

    socket.on('launchGame', (data, cb) => {
      const party = getPartyBySocket(socket.id);
      if (!party) return cb({ ok: false, error: 'Not in a party' });
      const actor = Array.from(party.members.values()).find((m) => m.socketId === socket.id);
      if (!actor || actor.playerId !== party.hostPlayerId) {
        socketLogger.warn(
          {
            partyId: party.partyId,
            inviteCode: party.inviteCode,
            playerId: actor?.playerId ?? data.playerId,
          },
          'launchGame rejected: actor is not party host'
        );
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
      scheduleMatchTimeout(party.partyId, () => triggerMatchTimeout(party));

      broadcastParty(io, party);
      socketLogger.info(
        {
          partyId: party.partyId,
          inviteCode: party.inviteCode,
          gameId: party.selectedGameId,
          matchKey,
          connectedPlayers: connected,
        },
        'host launched match'
      );
      cb({ ok: true });
    });

    socket.on('replayGame', (data, cb) => {
      const party = getPartyBySocket(socket.id);
      if (!party) return cb({ ok: false, error: 'Not in a party' });
      const actor = Array.from(party.members.values()).find((m) => m.socketId === socket.id);
      if (!actor || actor.playerId !== party.hostPlayerId) {
        socketLogger.warn(
          {
            partyId: party.partyId,
            inviteCode: party.inviteCode,
            playerId: actor?.playerId ?? data.playerId,
            gameId: party.activeMatch?.gameId,
          },
          'replayGame rejected: actor is not party host'
        );
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
      if (connected > game.definition.maxPlayers) {
        return cb({
          ok: false,
          error: `Too many players (max ${game.definition.maxPlayers})`,
        });
      }

      const previousMatchKey = party.activeMatch.matchKey;
      const currentGameId = party.activeMatch.gameId;
      const newMatchKey = nanoid(16);

      party.pendingCleanupMatchKey = previousMatchKey;
      party.activeMatch = {
        gameId: currentGameId,
        matchKey: newMatchKey,
        namespace: party.activeMatch.namespace,
        startedAt: Date.now(),
      };
      scheduleMatchTimeout(party.partyId, () => triggerMatchTimeout(party));

      broadcastParty(io, party);

      setTimeout(() => {
        try {
          game.cleanupMatch(previousMatchKey);
          partyLogger.info(
            {
              partyId: party.partyId,
              inviteCode: party.inviteCode,
              gameId: currentGameId,
              matchKey: previousMatchKey,
            },
            'cleaned up replayed match'
          );
        } catch (err) {
          partyLogger.warn(
            {
              partyId: party.partyId,
              inviteCode: party.inviteCode,
              matchKey: previousMatchKey,
              err: toLoggableError(err),
            },
            'cleanupMatch failed after replay'
          );
        }
        if (party.pendingCleanupMatchKey === previousMatchKey) {
          party.pendingCleanupMatchKey = null;
        }
      }, 5000);

      socketLogger.info(
        {
          partyId: party.partyId,
          inviteCode: party.inviteCode,
          gameId: currentGameId,
          previousMatchKey,
          newMatchKey,
          connectedPlayers: connected,
        },
        'host replayed match'
      );
      cb({ ok: true });
    });

    socket.on('returnToLobby', (data, cb) => {
      const party = getPartyBySocket(socket.id);
      if (!party) return cb({ ok: false, error: 'Not in a party' });
      const actor = Array.from(party.members.values()).find((m) => m.socketId === socket.id);
      if (!actor || actor.playerId !== party.hostPlayerId) {
        socketLogger.warn(
          {
            partyId: party.partyId,
            inviteCode: party.inviteCode,
            playerId: actor?.playerId ?? data.playerId,
            gameId: party.activeMatch?.gameId,
            matchKey: party.activeMatch?.matchKey,
          },
          'returnToLobby rejected: actor is not party host'
        );
        return cb({ ok: false, error: 'Only the host can return to lobby' });
      }
      if (!party.activeMatch) {
        return cb({ ok: false, error: 'No active match' });
      }

      const matchToClean = party.activeMatch;
      party.activeMatch = null;
      party.status = 'returning';
      party.returnAcks = new Set();
      clearMatchTimeout(party.partyId);

      broadcastParty(io, party);
      cb({ ok: true });

      const game = getGame(matchToClean.gameId);
      socketLogger.info(
        {
          partyId: party.partyId,
          inviteCode: party.inviteCode,
          gameId: matchToClean.gameId,
          matchKey: matchToClean.matchKey,
        },
        'host requested return to lobby'
      );
      scheduleReturnCleanup(io, party, matchToClean.matchKey, game?.cleanupMatch, partyLogger);
    });

    socket.on('ackReturnedToLobby', (data) => {
      const party = getPartyBySocket(socket.id);
      if (!party || party.status !== 'returning') return;

      const member = party.members.get(data.playerId);
      if (!member || member.socketId !== socket.id) return;

      party.returnAcks.add(data.playerId);

      const connected = Array.from(party.members.values())
        .filter((m) => m.connected)
        .map((m) => m.playerId);

      const allAcked = connected.every((id) => party.returnAcks.has(id));
      if (allAcked && party.status === 'returning') {
        party.status = 'lobby';
        party.returnAcks = new Set();
        broadcastParty(io, party);
        socketLogger.info(
          {
            partyId: party.partyId,
            inviteCode: party.inviteCode,
            acknowledgedPlayers: connected.length,
          },
          'all connected players acknowledged lobby return'
        );
      }
    });

    socket.on('disconnect', (reason) => {
      const party = getPartyBySocket(socket.id);
      if (!party) {
        socketLogger.debug({ reason }, 'party client disconnected before party binding');
        return;
      }

      unregisterSocket(socket.id);

      const member = Array.from(party.members.values()).find((m) => m.socketId === socket.id);
      if (member) {
        member.connected = false;
        member.socketId = null;
      }

      if (member && party.hostPlayerId === member.playerId) {
        const nextConnected = Array.from(party.members.values()).find((m) => m.connected);
        if (nextConnected) {
          party.hostPlayerId = nextConnected.playerId;
        }
      }

      const anyConnected = Array.from(party.members.values()).some((m) => m.connected);
      if (!anyConnected) {
        schedulePartyCleanup(party.partyId);
        partyLogger.info(
          {
            partyId: party.partyId,
            inviteCode: party.inviteCode,
          },
          'scheduled party cleanup after last disconnect'
        );
      }

      broadcastParty(io, party);
      socketLogger.info(
        {
          reason,
          partyId: party.partyId,
          inviteCode: party.inviteCode,
          playerId: member?.playerId,
          hostPlayerId: party.hostPlayerId,
        },
        'party client disconnected'
      );
    });
  });
}

function scheduleReturnCleanup(
  io: Server,
  party: PartySession,
  matchKey: string,
  cleanupFn: ((key: string) => void) | undefined,
  logger: Logger
): void {
  setTimeout(() => {
    if (party.status === 'returning') {
      party.status = 'lobby';
      party.returnAcks = new Set();
      broadcastParty(io, party);
      logger.info(
        {
          partyId: party.partyId,
          inviteCode: party.inviteCode,
          matchKey,
        },
        'return-to-lobby timeout completed'
      );
    }
    if (cleanupFn) {
      try {
        cleanupFn(matchKey);
        logger.info(
          {
            partyId: party.partyId,
            inviteCode: party.inviteCode,
            matchKey,
          },
          'cleaned up finished match'
        );
      } catch (err) {
        logger.warn(
          {
            partyId: party.partyId,
            inviteCode: party.inviteCode,
            matchKey,
            err: toLoggableError(err),
          },
          'cleanupMatch failed while returning to lobby'
        );
      }
    }
  }, 10000);
}
