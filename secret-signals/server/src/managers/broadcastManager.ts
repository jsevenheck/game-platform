import type { Namespace } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '../../../core/src/events';
import type { CardView, PlayerView, Room, RoomView } from '../../../core/src/types';

type GameNamespace = Namespace<ClientToServerEvents, ServerToClientEvents>;

function toRoomView(room: Room, playerId?: string): RoomView {
  const players: PlayerView[] = Object.values(room.players).map((player) => ({
    id: player.id,
    name: player.name,
    score: player.score,
    connected: player.connected,
    isHost: player.isHost,
    team: player.team,
    role: player.role,
  }));

  const viewer = playerId ? room.players[playerId] : undefined;
  const isDirector = viewer?.role === 'director';
  const isEnded = room.phase === 'ended';

  const board: CardView[] = room.board.map((card) => ({
    word: card.word,
    type: isDirector || isEnded || card.revealed ? card.type : null,
    revealed: card.revealed,
    revealedBy: card.revealedBy,
  }));

  return {
    code: room.code,
    phase: room.phase,
    players,
    board,
    teams: room.teams,
    currentTurnTeam: room.currentTurnTeam,
    turnPhase: room.turnPhase,
    currentSignal: room.currentSignal,
    turnOrder: room.turnOrder,
    log: room.log,
    winnerTeam: room.winnerTeam,
    winningTeams: room.winningTeams,
    teamCount: room.teamCount,
    assassinPenaltyMode: room.assassinPenaltyMode,
    focusedCards: room.focusedCards,
  };
}

export function broadcastRoom(nsp: GameNamespace, room: Room): void {
  for (const player of Object.values(room.players)) {
    if (!player.socketId) continue;
    nsp.to(player.socketId).emit('roomState', toRoomView(room, player.id));
  }
}

export function sendRoomToPlayer(nsp: GameNamespace, room: Room, playerId: string): void {
  const player = room.players[playerId];
  if (!player?.socketId) return;
  nsp.to(player.socketId).emit('roomState', toRoomView(room, playerId));
}
