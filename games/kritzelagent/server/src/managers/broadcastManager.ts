import type { Namespace } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '../../../core/src/events';
import type { PrivateAssignment, RoomView, ServerRoom } from '../../../core/src/types';
import { currentDrawingPlayerId } from './roundManager';

type KritzelagentNamespace = Namespace<ClientToServerEvents, ServerToClientEvents>;

export function buildRoomView(room: ServerRoom): RoomView {
  const reveal = room.phase === 'reveal' || room.phase === 'ended';
  const voteCounts = reveal
    ? room.players.map((player) => ({
        playerId: player.id,
        name: player.name,
        votes: [...room.votes.values()].filter((targetId) => targetId === player.id).length,
      }))
    : [];

  return {
    roomCode: room.roomCode,
    phase: room.phase,
    currentRound: room.currentRound,
    totalRounds: room.totalRounds,
    category: room.topic?.category ?? null,
    strokes: room.strokes.map((stroke) => ({
      ...stroke,
      points: stroke.points.map((point) => ({ ...point })),
    })),
    players: room.players.map((player) => ({
      id: player.id,
      name: player.name,
      isHost: player.isHost,
      connected: player.connected,
      strokesSubmitted: player.strokesSubmitted,
      hasVoted: player.hasVoted,
    })),
    votes: room.players.map((player) => ({ playerId: player.id, hasVoted: player.hasVoted })),
    revealedAgentId: reveal ? room.agentId : null,
    revealedTopic: reveal ? (room.topic?.topic ?? null) : null,
    voteCounts,
    roundResult: reveal ? room.roundResult : null,
    scores: room.players.map((player) => ({
      playerId: player.id,
      name: player.name,
      points: room.scores.get(player.id) ?? 0,
    })),
    drawingTurn: room.drawingTurn,
    totalDrawingTurns: room.drawingOrder.length * 2,
    activePlayerId: currentDrawingPlayerId(room),
  };
}

export function privateAssignmentFor(room: ServerRoom, playerId: string): PrivateAssignment | null {
  if (!room.topic || !room.agentId || !room.players.some((player) => player.id === playerId))
    return null;
  const isAgent = room.agentId === playerId;
  return {
    category: room.topic.category,
    topic: isAgent ? null : room.topic.topic,
    isAgent,
  };
}

export function sendPrivateAssignment(
  nsp: KritzelagentNamespace,
  room: ServerRoom,
  playerId: string
): void {
  const player = room.players.find((candidate) => candidate.id === playerId);
  const assignment = privateAssignmentFor(room, playerId);
  if (player?.socketId && player.connected && assignment) {
    nsp.to(player.socketId).emit('privateAssignment', assignment);
  }
}

export function broadcastRoom(nsp: KritzelagentNamespace, room: ServerRoom): void {
  const view = buildRoomView(room);
  for (const player of room.players) {
    if (player.socketId && player.connected) {
      nsp.to(player.socketId).emit('roomUpdate', view);
      nsp.to(player.socketId).emit('phaseChange', { phase: view.phase });
      if (room.phase === 'drawing' || room.phase === 'voting' || room.phase === 'agentGuess') {
        sendPrivateAssignment(nsp, room, player.id);
      }
    }
  }
}
