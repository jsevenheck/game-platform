import type { Namespace } from 'socket.io';
import type {
  Room,
  RoomView,
  RoundView,
  PlayerView,
  RoundPlayerView,
} from '../../../core/src/types';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  ActionResolvedEvent,
} from '../../../core/src/events';

type Flip7Namespace = Namespace<ClientToServerEvents, ServerToClientEvents>;

function toPlayerViews(room: Room): PlayerView[] {
  return Object.values(room.players).map((p) => ({
    id: p.id,
    name: p.name,
    totalScore: p.totalScore,
    connected: p.connected,
    isHost: p.isHost,
  }));
}

function toRoundView(room: Room): RoundView | null {
  const round = room.currentRound;
  if (!round) return null;

  const playerViews: RoundPlayerView[] = round.turnOrder.map((id) => {
    const rp = round.players[id];
    return {
      playerId: id,
      status: rp.status,
      numberCards: [...rp.numberCards],
      modifierAdds: [...rp.modifierAdds],
      hasX2: rp.hasX2,
      hasSecondChance: rp.hasSecondChance,
      flipThreeRemaining: rp.flipThreeRemaining,
      lastDrawnCard: rp.lastDrawnCard ?? null,
    };
  });

  // When the round has ended there is no active turn — return null so clients
  // don't incorrectly highlight a player as the current actor.
  const currentTurnPlayerId =
    round.roundEndReason !== null ? null : (round.turnOrder[round.currentTurnIndex] ?? null);

  return {
    roundNumber: round.roundNumber,
    phase: round.phase,
    currentTurnPlayerId,
    deckSize: round.deck.length,
    discardSize: round.discard.length,
    players: playerViews,
    pendingAction: round.pendingAction
      ? {
          drawerId: round.pendingAction.drawerId,
          action: round.pendingAction.action,
          eligibleTargets: [...round.pendingAction.eligibleTargets],
        }
      : null,
    roundEndReason: round.roundEndReason,
    flip7PlayerId: round.flip7PlayerId,
  };
}

function toRoomView(room: Room): RoomView {
  return {
    code: room.code,
    ownerId: room.ownerId,
    phase: room.phase,
    players: toPlayerViews(room),
    targetScore: room.targetScore,
    currentRound: toRoundView(room),
    roundHistory: room.roundHistory,
    winnerIds: room.winnerIds,
  };
}

export function broadcastRoom(nsp: Flip7Namespace, room: Room): void {
  const view = toRoomView(room);
  for (const player of Object.values(room.players)) {
    if (player.socketId && player.connected) {
      nsp.to(player.socketId).emit('roomUpdate', view);
    }
  }
}

export function sendRoomToPlayer(nsp: Flip7Namespace, room: Room, playerId: string): void {
  const player = room.players[playerId];
  if (player?.socketId && player.connected) {
    const view = toRoomView(room);
    nsp.to(player.socketId).emit('roomUpdate', view);
  }
}

export function broadcastActionResolved(
  nsp: Flip7Namespace,
  room: Room,
  event: ActionResolvedEvent
): void {
  for (const player of Object.values(room.players)) {
    if (player.socketId && player.connected) {
      nsp.to(player.socketId).emit('actionResolved', event);
    }
  }
}
