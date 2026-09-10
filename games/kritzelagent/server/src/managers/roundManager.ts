import { nanoid } from 'nanoid';
import { DRAWING_TURNS_PER_PLAYER, MAX_PLAYERS, MIN_PLAYERS } from '../../../core/src/constants';
import { normalizeStroke } from '../../../core/src/drawing';
import type { ServerRoom } from '../../../core/src/types';
import { findPlayer } from '../models/room';
import { pickRandomTopics, topicMatchesGuess } from '../utils/topicLibrary';
import { getVoteLeaders, toRoundResult } from './scoreManager';

export class KritzelagentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'KritzelagentError';
  }
}

export function connectedPlayers(room: ServerRoom) {
  return room.players.filter((player) => player.connected);
}

export function currentDrawingPlayerId(room: ServerRoom): string | null {
  if (room.phase !== 'drawing' || room.drawingOrder.length === 0) return null;
  return room.drawingOrder[room.drawingTurn % room.drawingOrder.length] ?? null;
}

export function allConnectedPlayersDrew(room: ServerRoom): boolean {
  const players = connectedPlayers(room);
  return (
    players.length > 0 &&
    players.every((player) => player.strokesSubmitted >= DRAWING_TURNS_PER_PLAYER)
  );
}

export function allConnectedPlayersVoted(room: ServerRoom): boolean {
  const players = connectedPlayers(room);
  return players.length > 0 && players.every((player) => room.votes.has(player.id));
}

function prepareTopicDeck(room: ServerRoom): void {
  const deck = pickRandomTopics(room.totalRounds);
  if (deck.length < room.totalRounds) {
    throw new KritzelagentError(
      `Need ${room.totalRounds} unique topics, library has ${deck.length}`
    );
  }
  room.topicDeck = deck;
}

function resetRoundState(room: ServerRoom): void {
  room.topic = room.topicDeck[room.currentRound - 1] ?? null;
  if (!room.topic) throw new KritzelagentError('Topic deck exhausted');
  const connected = connectedPlayers(room);
  room.agentId = connected[Math.floor(Math.random() * connected.length)]?.id ?? null;
  room.strokes = [];
  room.votes.clear();
  room.roundResult = null;
  room.drawingOrder = connected.map((player) => player.id);
  room.drawingTurn = 0;
  for (const player of room.players) {
    player.strokesSubmitted = 0;
    player.hasVoted = false;
  }
  room.phase = 'drawing';
}

export function startGame(room: ServerRoom): void {
  if (room.phase !== 'lobby')
    throw new KritzelagentError(`Cannot start game in phase ${room.phase}`);
  const players = connectedPlayers(room);
  if (players.length < MIN_PLAYERS) {
    throw new KritzelagentError(
      `Need at least ${MIN_PLAYERS} connected players to start, have ${players.length}`
    );
  }
  if (room.players.length > MAX_PLAYERS) {
    throw new KritzelagentError(`Too many players (max ${MAX_PLAYERS})`);
  }
  for (const player of room.players) room.scores.set(player.id, 0);
  room.currentRound = 1;
  prepareTopicDeck(room);
  resetRoundState(room);
}

function advanceDrawingTurn(room: ServerRoom): void {
  if (allConnectedPlayersDrew(room)) {
    room.phase = 'voting';
    return;
  }

  const connected = new Set(connectedPlayers(room).map((player) => player.id));
  const totalTurns = room.drawingOrder.length * DRAWING_TURNS_PER_PLAYER;
  while (room.drawingTurn < totalTurns) {
    const playerId = room.drawingOrder[room.drawingTurn % room.drawingOrder.length];
    const player = playerId ? findPlayer(room, playerId) : undefined;
    if (player && connected.has(player.id) && player.strokesSubmitted < DRAWING_TURNS_PER_PLAYER)
      return;
    room.drawingTurn += 1;
  }

  if (allConnectedPlayersDrew(room)) room.phase = 'voting';
}

function resolveVotingIfReady(room: ServerRoom): void {
  if (room.phase !== 'voting' || !allConnectedPlayersVoted(room)) return;

  const leaders = getVoteLeaders(room.votes);
  const agentWasCaught = leaders.length === 1 && leaders[0] === room.agentId;
  const agentConnected = connectedPlayers(room).some((player) => player.id === room.agentId);

  if (agentWasCaught && agentConnected) {
    room.phase = 'agentGuess';
    return;
  }

  // A disconnected caught agent cannot submit the private guess. Treat the
  // missing guess as incorrect so the remaining players are not stranded.
  resolveVotes(room, agentWasCaught ? false : null);
}

/** Re-evaluate phase completion after a player disconnects. */
export function recheckAfterDisconnect(room: ServerRoom): void {
  if (room.phase === 'drawing') advanceDrawingTurn(room);
  if (room.phase === 'voting') resolveVotingIfReady(room);
  if (
    room.phase === 'agentGuess' &&
    !connectedPlayers(room).some((player) => player.id === room.agentId)
  ) {
    resolveVotes(room, false);
  }
}

export function submitStroke(room: ServerRoom, playerId: string, points: unknown): void {
  if (room.phase !== 'drawing') {
    throw new KritzelagentError(`Cannot submit stroke in phase ${room.phase}`);
  }
  const player = findPlayer(room, playerId);
  const activePlayerId = currentDrawingPlayerId(room);
  if (!player || !player.connected)
    throw new KritzelagentError('Player is not connected in this room');
  if (activePlayerId !== playerId) throw new KritzelagentError('It is not your drawing turn');
  if (player.strokesSubmitted >= DRAWING_TURNS_PER_PLAYER) {
    throw new KritzelagentError('You already drew all strokes this round');
  }
  const normalized = normalizeStroke(points);
  if (!normalized) throw new KritzelagentError('Invalid stroke');

  room.strokes.push({
    id: nanoid(10),
    playerId,
    turn: room.drawingTurn,
    points: normalized,
  });
  player.strokesSubmitted += 1;
  room.drawingTurn += 1;
  advanceDrawingTurn(room);
}

function resolveVotes(room: ServerRoom, agentGuessCorrect: boolean | null): void {
  if (!room.topic || !room.agentId) throw new KritzelagentError('Round assignment is missing');
  const voteLeaders = getVoteLeaders(room.votes);
  const result = toRoundResult({
    agentId: room.agentId,
    artistIds: room.players
      .filter((player) => player.id !== room.agentId)
      .map((player) => player.id),
    voteLeaders,
    agentGuessCorrect,
    topic: room.topic.topic,
  });
  room.roundResult = result;
  for (const [playerId, delta] of Object.entries(result.scoreDeltas)) {
    room.scores.set(playerId, (room.scores.get(playerId) ?? 0) + delta);
  }
  room.phase = 'reveal';
}

export function submitVote(room: ServerRoom, playerId: string, targetId: string): void {
  if (room.phase !== 'voting')
    throw new KritzelagentError(`Cannot submit vote in phase ${room.phase}`);
  const player = findPlayer(room, playerId);
  const target = findPlayer(room, targetId);
  if (!player?.connected) throw new KritzelagentError('Player is not connected in this room');
  if (!target || !target.connected)
    throw new KritzelagentError('Vote target is not connected in this room');
  if (playerId === targetId) throw new KritzelagentError('You cannot vote for yourself');
  if (room.votes.has(playerId)) throw new KritzelagentError('You already voted this round');

  room.votes.set(playerId, targetId);
  player.hasVoted = true;
  resolveVotingIfReady(room);
}

export function submitAgentGuess(room: ServerRoom, playerId: string, guess: string): void {
  if (room.phase !== 'agentGuess')
    throw new KritzelagentError(`Cannot guess in phase ${room.phase}`);
  if (playerId !== room.agentId) throw new KritzelagentError('Only the Kritzelagent can guess');
  if (!guess.trim() || guess.trim().length > 120)
    throw new KritzelagentError('Invalid topic guess');
  if (!room.topic) throw new KritzelagentError('Round topic is missing');
  resolveVotes(room, topicMatchesGuess(room.topic.topic, guess));
}

export function nextRound(room: ServerRoom): void {
  if (room.phase !== 'reveal') throw new KritzelagentError(`Cannot advance in phase ${room.phase}`);
  if (room.currentRound >= room.totalRounds) {
    room.phase = 'ended';
    return;
  }
  room.currentRound += 1;
  resetRoundState(room);
}

export function restartGame(room: ServerRoom): void {
  if (room.phase !== 'ended' && room.phase !== 'reveal') {
    throw new KritzelagentError(`Cannot restart in phase ${room.phase}`);
  }
  room.currentRound = 0;
  room.topic = null;
  room.topicDeck = [];
  room.agentId = null;
  room.strokes = [];
  room.votes.clear();
  room.roundResult = null;
  room.drawingOrder = [];
  room.drawingTurn = 0;
  for (const player of room.players) {
    player.strokesSubmitted = 0;
    player.hasVoted = false;
  }
  for (const player of room.players) room.scores.set(player.id, 0);
  room.phase = 'lobby';
}
