import { MAX_PLAYERS, MIN_PLAYERS, TARGET_COWS } from '../../../core/src/constants';
import { normalizeAnswer, resolveRound } from '../../../core/src/rules';
import type { Phase, ServerRoom } from '../../../core/src/types';
import { findPlayer } from '../models/room';
import { pickRandomPrompts } from '../utils/promptLibrary';

export class HerdMentalityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HerdMentalityError';
  }
}

export function allConnectedPlayersSubmitted(room: ServerRoom): boolean {
  const connected = room.players.filter((player) => player.connected);
  return connected.length > 0 && connected.every((player) => room.answers.has(player.id));
}

export function startGame(room: ServerRoom): void {
  if (room.phase !== 'lobby')
    throw new HerdMentalityError(`Cannot start game in phase ${room.phase}`);
  const connected = room.players.filter((player) => player.connected);
  if (connected.length < MIN_PLAYERS)
    throw new HerdMentalityError(`Need at least ${MIN_PLAYERS} connected players to start`);
  if (room.players.length > MAX_PLAYERS)
    throw new HerdMentalityError(`Too many players (max ${MAX_PLAYERS})`);
  room.promptDeck = pickRandomPrompts(room.totalRounds);
  if (room.promptDeck.length < room.totalRounds)
    throw new HerdMentalityError('Not enough unique prompts');
  for (const player of room.players) room.cows.set(player.id, 0);
  room.pinkCowPlayerId = null;
  room.currentRound = 0;
  advanceRound(room);
}

function advanceRound(room: ServerRoom): void {
  room.currentRound += 1;
  room.prompt = room.promptDeck[room.currentRound - 1] ?? null;
  if (!room.prompt) throw new HerdMentalityError('Prompt deck exhausted');
  room.answers.clear();
  room.roundResult = null;
  room.phase = 'answering';
}

export function submitAnswer(room: ServerRoom, playerId: string, rawAnswer: unknown): void {
  if (room.phase !== 'answering')
    throw new HerdMentalityError(`Cannot answer in phase ${room.phase}`);
  const player = findPlayer(room, playerId);
  if (!player || !player.connected)
    throw new HerdMentalityError('Player is not connected to this room');
  if (room.answers.has(playerId)) throw new HerdMentalityError('Answer already submitted');
  if (!normalizeAnswer(rawAnswer)) throw new HerdMentalityError('Please enter a valid answer');
  room.answers.set(playerId, rawAnswer as string);
  if (allConnectedPlayersSubmitted(room)) room.phase = 'allSubmitted';
}

export function revealAnswers(room: ServerRoom): void {
  if (room.phase !== 'allSubmitted')
    throw new HerdMentalityError(`Cannot reveal in phase ${room.phase}`);
  const entries = [...room.answers.entries()].map(([playerId, answer]) => ({ playerId, answer }));
  const result = resolveRound(entries);
  for (const group of result.groups) {
    group.playerNames = group.playerIds.map((id) => findPlayer(room, id)?.name ?? '');
    if (group.count >= 2) {
      for (const id of group.playerIds) room.cows.set(id, (room.cows.get(id) ?? 0) + 1);
    }
  }
  if (result.pinkCowPlayerId) {
    room.pinkCowPlayerId = result.pinkCowPlayerId;
  }
  const winnerIds = room.players
    .filter(
      (player) =>
        (room.cows.get(player.id) ?? 0) >= TARGET_COWS && room.pinkCowPlayerId !== player.id
    )
    .map((player) => player.id);
  result.winnerIds = winnerIds;
  room.roundResult = result;
  room.phase = winnerIds.length > 0 || room.currentRound >= room.totalRounds ? 'ended' : 'reveal';
}

export function nextRound(room: ServerRoom): void {
  if (room.phase !== 'reveal')
    throw new HerdMentalityError(`Cannot advance in phase ${room.phase}`);
  advanceRound(room);
}

export function restartGame(room: ServerRoom): void {
  if (room.phase !== 'ended') throw new HerdMentalityError(`Cannot restart in phase ${room.phase}`);
  room.phase = 'lobby' as Phase;
  room.currentRound = 0;
  room.prompt = null;
  room.promptDeck = [];
  room.answers.clear();
  room.roundResult = null;
  room.pinkCowPlayerId = null;
  for (const player of room.players) room.cows.set(player.id, 0);
}
