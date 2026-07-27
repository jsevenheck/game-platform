import { computeDisplayRange } from '../../../core/src/range';
import type {
  GuessEntry,
  PlayerView,
  RoomView,
  ScoreEntry,
  ServerRoom,
  WinnerEntry,
} from '../../../core/src/types';
import { computeRoundWinners } from './scoreManager';

export function buildRoomView(room: ServerRoom): RoomView {
  const players: PlayerView[] = room.players.map((p) => ({
    id: p.id,
    name: p.name,
    isHost: p.isHost,
    connected: p.connected,
    hasSubmitted: room.guesses.has(p.id),
  }));

  const guesses: GuessEntry[] = Array.from(room.guesses.entries()).map(([playerId, guess]) => ({
    playerId,
    guess,
  }));

  const solution =
    room.phase === 'reveal' || room.phase === 'gameEnd' ? (room.question?.answer ?? null) : null;

  const winners: WinnerEntry[] =
    solution !== null
      ? (() => {
          const winnerIds = computeRoundWinners(guesses, solution);
          return room.players
            .filter((p) => winnerIds.includes(p.id))
            .map((p) => ({ playerId: p.id, name: p.name }));
        })()
      : [];

  const scores: ScoreEntry[] = room.players.map((p) => ({
    playerId: p.id,
    name: p.name,
    points: room.scores.get(p.id) ?? 0,
  }));

  // Compute display range from guesses (+ solution if revealed) so the
  // client and server always agree on the visible number line.
  const guessValues = guesses.map((g) => g.guess);
  const displayRange =
    guessValues.length > 0 || solution !== null ? computeDisplayRange(guessValues, solution) : null;

  return {
    roomCode: room.roomCode,
    phase: room.phase,
    currentRound: room.currentRound,
    totalRounds: room.totalRounds,
    question: room.question ? { id: room.question.id, text: room.question.text } : null,
    players,
    guesses,
    solution,
    winners,
    scores,
    displayRange,
  };
}
