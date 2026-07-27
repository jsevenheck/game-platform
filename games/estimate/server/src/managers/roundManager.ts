import { MAX_PLAYERS, MIN_PLAYERS, GUESS_VALUE_LIMIT } from '../../../core/src/constants';
import type { Phase, Question, ServerRoom } from '../../../core/src/types';
import { findPlayer } from '../models/room';
import { pickRandomQuestions } from '../utils/questionLibrary';
import { computeRoundWinners } from './scoreManager';

export class EstimateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EstimateError';
  }
}

export function isFiniteGuess(guess: unknown): guess is number {
  return (
    typeof guess === 'number' && Number.isFinite(guess) && Math.abs(guess) <= GUESS_VALUE_LIMIT
  );
}

export function allConnectedPlayersSubmitted(room: ServerRoom): boolean {
  return room.players.filter((p) => p.connected).every((p) => room.guesses.has(p.id));
}

function pickNextQuestion(): Question {
  const lib = pickRandomQuestions(1);
  if (lib.length === 0) {
    throw new EstimateError('Question library is empty');
  }
  return lib[0]!;
}

/** Start the first round. The host triggers this. */
export function startGame(room: ServerRoom): void {
  if (room.phase !== 'lobby') {
    throw new EstimateError(`Cannot start game in phase ${room.phase}`);
  }
  if (room.players.length < MIN_PLAYERS) {
    throw new EstimateError(
      `Need at least ${MIN_PLAYERS} players to start, have ${room.players.length}`
    );
  }
  if (room.players.length > MAX_PLAYERS) {
    throw new EstimateError(`Too many players (max ${MAX_PLAYERS})`);
  }

  // Reset scores.
  for (const p of room.players) room.scores.set(p.id, 0);

  room.currentRound = 0;
  advanceRound(room);
}

function advanceRound(room: ServerRoom): void {
  room.currentRound += 1;
  room.question = pickNextQuestion();
  room.guesses.clear();
  room.phase = 'guessing';
}

/** Submit (or overwrite) a player's guess for the current round. */
export function submitGuess(room: ServerRoom, playerId: string, guess: number): void {
  if (room.phase !== 'guessing') {
    throw new EstimateError(`Cannot submit guess in phase ${room.phase}`);
  }
  const player = findPlayer(room, playerId);
  if (!player) {
    throw new EstimateError(`Player ${playerId} not in room`);
  }
  if (!player.connected) {
    throw new EstimateError(`Player ${playerId} is disconnected`);
  }
  if (!isFiniteGuess(guess)) {
    throw new EstimateError('Invalid guess');
  }

  room.guesses.set(playerId, guess);

  if (allConnectedPlayersSubmitted(room)) {
    // Server-driven auto-transition: the room view will show all guesses,
    // but the solution stays hidden until the host explicitly reveals.
    room.phase = 'allSubmitted';
  }
}

/** Host reveals the solution; winners are computed and awarded. */
export function revealSolution(room: ServerRoom): void {
  if (room.phase !== 'allSubmitted') {
    throw new EstimateError(`Cannot reveal in phase ${room.phase}`);
  }
  if (!room.question) {
    throw new EstimateError('No question to reveal');
  }

  // Award +1 to every winner (ties all get the point).
  const guesses = Array.from(room.guesses.entries()).map(([playerId, guess]) => ({
    playerId,
    guess,
  }));
  const winnerIds = computeRoundWinners(guesses, room.question.answer);
  for (const id of winnerIds) {
    room.scores.set(id, (room.scores.get(id) ?? 0) + 1);
  }

  // Phase stays 'reveal' so clients continue to show the solution +
  // winner banner; host then presses "Nächste Frage" to advance.
  room.phase = 'reveal';
}

/** Host advances to the next round, or finishes the game. */
export function nextRound(room: ServerRoom): void {
  if (room.phase !== 'reveal') {
    throw new EstimateError(`Cannot advance in phase ${room.phase}`);
  }

  if (room.currentRound >= room.totalRounds) {
    finishGame(room);
    return;
  }
  advanceRound(room);
}

/** Host restarts the game in the same room (scores reset, new questions). */
export function restartGame(room: ServerRoom): void {
  const currentPhase = room.phase;
  if (currentPhase !== 'gameEnd' && currentPhase !== 'reveal') {
    throw new EstimateError(`Cannot restart in phase ${currentPhase}`);
  }
  for (const p of room.players) room.scores.set(p.id, 0);
  room.currentRound = 0;
  room.question = null;
  room.guesses.clear();
  room.phase = 'lobby' as Phase;
}

function finishGame(room: ServerRoom): void {
  room.phase = 'gameEnd';
  // Keep the last question + guesses so the final view can show who
  // won the deciding round.
}

/** Convenience: returns the list of playerIds that submitted this round. */
export function submittedPlayerIds(room: ServerRoom): string[] {
  return Array.from(room.guesses.keys());
}
