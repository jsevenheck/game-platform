import type { Namespace } from 'socket.io';
import type { ServerToClientEvents, ClientToServerEvents } from '../../../core/src/events';
import type { Room, RoomView, PlayerView } from '../../../core/src/types';

type GameNamespace = Namespace<ClientToServerEvents, ServerToClientEvents>;

function toPlayerView(room: Room): PlayerView[] {
  return Object.values(room.players).map((player) => ({
    id: player.id,
    name: player.name,
    score: player.score,
    connected: player.connected,
    isHost: player.isHost,
  }));
}

function toRoomViewForPlayer(room: Room, playerId: string): RoomView {
  const players = toPlayerView(room);
  const isInfiltrator = room.infiltratorIds.includes(playerId);
  const isRevealOrEnded = room.phase === 'reveal' || room.phase === 'ended';
  const isSecretWordVisible =
    room.phase === 'ended' || (room.phase === 'reveal' && !room.waitingForGuess);
  const allDescriptionsIn = room.descriptionOrder.every(
    (descriptionPlayerId) => room.descriptions[descriptionPlayerId] !== undefined
  );
  const allVotesIn =
    Object.values(room.players).filter((player) => player.connected).length ===
    Object.keys(room.votes).length;

  return {
    code: room.code,
    phase: room.phase,
    players,
    infiltratorCount: room.infiltratorCount,
    discussionDurationMs: room.discussionDurationMs,
    targetScore: room.targetScore,
    yourWord:
      room.phase === 'lobby'
        ? null
        : isSecretWordVisible
          ? room.secretWord
          : isInfiltrator
            ? null
            : room.secretWord,
    roundNumber: room.roundNumber,
    wordLibraryCount: room.wordLibrary.length,
    submittedDescriptionIds: Object.keys(room.descriptions),
    descriptions:
      room.phase === 'lobby'
        ? null
        : allDescriptionsIn ||
            room.phase === 'description' ||
            room.phase === 'discussion' ||
            room.phase === 'voting' ||
            isRevealOrEnded
          ? { ...room.descriptions }
          : null,
    descriptionOrder: [...room.descriptionOrder],
    currentDescriberId: room.phase === 'description' ? room.currentDescriberId : null,
    discussionEndsAt: room.discussionEndsAt,
    submittedVoteIds: Object.keys(room.votes),
    votes: allVotesIn || isRevealOrEnded ? { ...room.votes } : null,
    revealedInfiltrators: isRevealOrEnded ? room.revealedInfiltrators : [],
    infiltratorIds: isRevealOrEnded ? [...room.infiltratorIds] : null,
    secretWord: isSecretWordVisible ? room.secretWord : null,
    waitingForGuess: room.waitingForGuess,
    infiltratorGuess: isRevealOrEnded ? room.infiltratorGuess : null,
    lastRoundResult: isRevealOrEnded ? room.lastRoundResult : null,
    roundHistory: room.roundHistory,
  };
}

export function broadcastRoom(nsp: GameNamespace, room: Room): void {
  for (const player of Object.values(room.players)) {
    if (!player.socketId) continue;
    nsp.to(player.socketId).emit('roomState', toRoomViewForPlayer(room, player.id));
  }
}

export function sendRoomToPlayer(nsp: GameNamespace, room: Room, playerId: string): void {
  const player = room.players[playerId];
  if (!player?.socketId) return;
  nsp.to(player.socketId).emit('roomState', toRoomViewForPlayer(room, playerId));
}
