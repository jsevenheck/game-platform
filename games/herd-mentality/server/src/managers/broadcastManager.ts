import type {
  AnswerEntry,
  PlayerView,
  RoomView,
  ScoreEntry,
  ServerRoom,
  WinnerEntry,
} from '../../../core/src/types';

export function buildRoomView(room: ServerRoom): RoomView {
  const players: PlayerView[] = room.players.map((player) => ({
    id: player.id,
    name: player.name,
    isHost: player.isHost,
    connected: player.connected,
    hasSubmitted: room.answers.has(player.id),
  }));
  const revealed = room.phase === 'reveal' || room.phase === 'ended';
  const answers: AnswerEntry[] = revealed
    ? [...room.answers.entries()].map(([playerId, answer]) => ({ playerId, answer }))
    : [];
  const winners: WinnerEntry[] =
    revealed && room.roundResult
      ? room.players
          .filter((player) => room.roundResult!.winnerIds.includes(player.id))
          .map((player) => ({ playerId: player.id, name: player.name }))
      : [];
  const scores: ScoreEntry[] = room.players.map((player) => ({
    playerId: player.id,
    name: player.name,
    cows: room.cows.get(player.id) ?? 0,
    hasPinkCow: room.pinkCowPlayerId === player.id,
  }));
  return {
    roomCode: room.roomCode,
    phase: room.phase,
    currentRound: room.currentRound,
    totalRounds: room.totalRounds,
    prompt: room.prompt ? { id: room.prompt.id, text: room.prompt.text } : null,
    players,
    answers,
    result: revealed ? room.roundResult : null,
    winners,
    scores,
  };
}
