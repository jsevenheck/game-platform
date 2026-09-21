import {
  MAX_PLAYERS,
  MAX_TARGET_COWS,
  MAX_TOTAL_ROUNDS,
  MIN_PLAYERS,
  MIN_TARGET_COWS,
  MIN_TOTAL_ROUNDS,
} from '../../../core/src/constants';
import { normalizeAnswer, getMajorityGroup, resolveRound } from '../../../core/src/rules';
import type { Phase, ServerRoom } from '../../../core/src/types';
import { findPlayer } from '../models/room';
import { getPromptLibrary, pickRandomPrompts } from '../utils/promptLibrary';

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

/** Host tunes the match length and the cow goal; only possible before the game starts. */
export function updateSettings(
  room: ServerRoom,
  settings: { totalRounds?: number; targetCows?: number }
): void {
  if (room.phase !== 'lobby')
    throw new HerdMentalityError(`Cannot change settings in phase ${room.phase}`);
  const { totalRounds, targetCows } = settings;
  if (totalRounds !== undefined) {
    const maxRounds = Math.min(MAX_TOTAL_ROUNDS, getPromptLibrary(room.locale).length);
    if (!Number.isInteger(totalRounds) || totalRounds < MIN_TOTAL_ROUNDS || totalRounds > maxRounds)
      throw new HerdMentalityError(
        `Rounds must be a whole number between ${MIN_TOTAL_ROUNDS} and ${maxRounds}`
      );
  }
  if (targetCows !== undefined) {
    if (
      !Number.isInteger(targetCows) ||
      targetCows < MIN_TARGET_COWS ||
      targetCows > MAX_TARGET_COWS
    )
      throw new HerdMentalityError(
        `Target cows must be a whole number between ${MIN_TARGET_COWS} and ${MAX_TARGET_COWS}`
      );
  }
  if (totalRounds !== undefined) room.totalRounds = totalRounds;
  if (targetCows !== undefined) {
    room.baseTargetCows = targetCows;
    room.targetCows = targetCows;
  }
}

export function startGame(room: ServerRoom): void {
  if (room.phase !== 'lobby')
    throw new HerdMentalityError(`Cannot start game in phase ${room.phase}`);
  const connected = room.players.filter((player) => player.connected);
  if (connected.length < MIN_PLAYERS)
    throw new HerdMentalityError(`Need at least ${MIN_PLAYERS} connected players to start`);
  if (room.players.length > MAX_PLAYERS)
    throw new HerdMentalityError(`Too many players (max ${MAX_PLAYERS})`);
  room.promptDeck = pickRandomPrompts(room.totalRounds, room.locale);
  if (room.promptDeck.length < room.totalRounds)
    throw new HerdMentalityError('Not enough unique prompts');
  for (const player of room.players) room.cows.set(player.id, 0);
  room.targetCows = room.baseTargetCows;
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
  const majorityGroup = getMajorityGroup(result.groups);
  for (const group of result.groups) {
    group.playerNames = group.playerIds.map((id) => findPlayer(room, id)?.name ?? '');
  }
  if (majorityGroup) {
    for (const id of majorityGroup.playerIds) {
      room.cows.set(id, (room.cows.get(id) ?? 0) + 1);
    }
  }
  if (result.pinkCowPlayerId) {
    room.pinkCowPlayerId = result.pinkCowPlayerId;
  }
  const qualifiedPlayers = room.players.filter(
    (player) =>
      (room.cows.get(player.id) ?? 0) >= room.targetCows && room.pinkCowPlayerId !== player.id
  );
  const winnerIds = qualifiedPlayers.length === 1 ? [qualifiedPlayers[0]!.id] : [];
  if (qualifiedPlayers.length > 1) {
    // Official tiebreaker: if multiple players reach the target in one round,
    // raise the target by one and continue until one player leads.
    room.targetCows += 1;
  }
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
  room.targetCows = room.baseTargetCows;
  for (const player of room.players) room.cows.set(player.id, 0);
}
