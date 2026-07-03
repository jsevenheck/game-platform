import { nanoid } from 'nanoid';
import { analyzePlay, comparePlayAnalyses } from '../../../core/src/analyzePlay';
import { buildDeck, flipCard, type ScoutCard } from '../../../core/src/deck';
import type { PlayedSet, Player, Room, RoundEndReason, TrickState } from '../../../core/src/types';

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function cardHasValue(card: ScoutCard, value: number): boolean {
  return card.playValue === value || card.scoutPoints === value;
}

function isPair(card: ScoutCard, a: number, b: number): boolean {
  return cardHasValue(card, a) && cardHasValue(card, b);
}

function buildPlayerCountDeck(playerCount: number): ScoutCard[] {
  const deck = buildDeck();
  if (playerCount === 3) return deck.filter((card) => !cardHasValue(card, 10));
  if (playerCount === 2 || playerCount === 4) return deck.filter((card) => !isPair(card, 9, 10));
  return deck;
}

function buildE2EDeck(): ScoutCard[] {
  const source = buildDeck();
  const selectedIds = new Set<string>();

  function takeByPlayValue(playValue: number): ScoutCard {
    const card = source.find(
      (candidate) => candidate.playValue === playValue && !selectedIds.has(candidate.id)
    );
    if (!card) throw new Error(`Missing E2E Scout card for play value ${playValue}`);
    selectedIds.add(card.id);
    return card;
  }

  const scriptedDeal = [...[1, 2, 9].map(takeByPlayValue), ...[3, 4, 5].map(takeByPlayValue)];

  return [...scriptedDeal, ...source.filter((card) => !selectedIds.has(card.id))];
}

function summarizePlay(playerId: string, cards: ScoutCard[], id = nanoid(10)): PlayedSet {
  const analysis = analyzePlay(cards);
  return {
    id,
    playerId,
    cards,
    kind: analysis.kind,
    count: analysis.count,
    highCard: analysis.highCard,
    lowCard: analysis.lowCard,
  };
}

export function comparePlays(
  candidate: Pick<PlayedSet, 'cards'>,
  current: Pick<PlayedSet, 'cards'>
): number {
  const candidateAnalysis = analyzePlay(candidate.cards);
  const currentAnalysis = analyzePlay(current.cards);
  return comparePlayAnalyses(candidateAnalysis, currentAnalysis);
}

export function beatsCurrentPlay(cards: ScoutCard[], current: PlayedSet | null): boolean {
  try {
    const candidate = summarizePlay('candidate', cards);
    if (!current) return true;
    return comparePlays(candidate, current) > 0;
  } catch {
    return false;
  }
}

export function flipPlayerRow(player: Player): void {
  if (player.setupConfirmed) throw new Error('Setup choice already made');
  player.row = [...player.row].reverse().map(flipCard);
  player.setupFlipped = true;
  player.setupConfirmed = true;
}

export function keepPlayerRow(player: Player): void {
  if (player.setupConfirmed) throw new Error('Setup choice already made');
  player.setupConfirmed = true;
}

export function setupComplete(room: Room): boolean {
  const connectedPlayerIds = room.playerOrder.filter(
    (playerId) => room.players[playerId]?.connected
  );
  return (
    connectedPlayerIds.length > 0 &&
    connectedPlayerIds.every((playerId) => room.players[playerId]?.setupConfirmed)
  );
}

const HAND_SIZES: Record<number, number> = { 2: 11, 3: 12, 4: 11, 5: 9 };
const E2E_HAND_SIZE = 3;

function playerOrderStartingFrom(room: Room, playerId: string | null | undefined): string[] {
  const leaderIndex = playerId ? room.playerOrder.indexOf(playerId) : -1;
  if (leaderIndex <= 0) return [...room.playerOrder];
  return [...room.playerOrder.slice(leaderIndex), ...room.playerOrder.slice(0, leaderIndex)];
}

function startPlayerForRound(room: Room): string {
  const index =
    (room.roundStartPlayerIndex + Math.max(0, room.roundNumber - 1)) % room.playerOrder.length;
  return room.playerOrder[index] ?? room.playerOrder[0];
}

function prepareRoundDeck(room: Room, order: string[]): ScoutCard[] {
  const useE2EDeal = process.env.E2E_TESTS === '1' && order.length === 2;
  if (useE2EDeal) return buildE2EDeck();

  if (order.length === 2) {
    if (room.roundNumber === 1 || room.twoPlayerReserve.length === 0) {
      const deck = shuffle(buildPlayerCountDeck(2));
      room.twoPlayerReserve = deck.slice(22);
      return deck.slice(0, 22);
    }
    const reserve = room.twoPlayerReserve;
    room.twoPlayerReserve = [];
    return reserve;
  }

  return shuffle(buildPlayerCountDeck(order.length));
}

function resetPlayerForRound(player: Player, playerCount: number): void {
  player.row = [];
  player.takenPile = [];
  player.setupFlipped = false;
  player.setupConfirmed = false;
  player.roundScore = 0;
  player.scoutTokens = 0;
  player.scoutAndShowTokens = playerCount === 2 ? 3 : 1;
}

export function startGame(room: Room): void {
  for (const player of Object.values(room.players)) {
    player.score = 0;
    player.roundScore = 0;
  }

  room.roundNumber = 0;
  room.totalRounds = process.env.E2E_TESTS === '1' ? 1 : room.playerOrder.length;
  room.roundStartPlayerIndex = Math.max(
    0,
    room.playerOrder.indexOf(room.hostId ?? room.playerOrder[0])
  );
  room.twoPlayerReserve = [];
  room.trickHistory = [];
  room.roundHistory = [];
  room.winnerIds = [];
  room.gameEndReason = null;
  room.phase = 'playing';

  startNextRound(room);
}

function startNextRound(room: Room): void {
  room.roundNumber += 1;
  const leaderId = startPlayerForRound(room);
  const order = playerOrderStartingFrom(room, leaderId);
  const deck = prepareRoundDeck(room, order);
  const handSize = process.env.E2E_TESTS === '1' ? E2E_HAND_SIZE : HAND_SIZES[order.length];

  if (!handSize) throw new Error('Unsupported player count');

  for (const playerId of order) {
    const player = room.players[playerId];
    resetPlayerForRound(player, order.length);
    player.row = deck.splice(0, handSize);
  }

  room.showPile = [];
  room.trick = null;
  room.phase = 'playing';
}

export function beginFirstTrickIfReady(room: Room): void {
  if (room.phase !== 'playing' || room.trick || !setupComplete(room)) return;
  startTrick(room, startPlayerForRound(room));
}

function isAvailableForTurn(room: Room, playerId: string): boolean {
  return Boolean(room.players[playerId]?.connected);
}

function isEligibleForCurrentPriorSet(trick: TrickState, playerId: string): boolean {
  if (trick.priorSetOwnerId && playerId === trick.priorSetOwnerId) return false;
  return !trick.scoutedPlayerIds.includes(playerId);
}

function firstAvailableTurnIndex(room: Room, turnOrder: string[], trick?: TrickState): number {
  const index = turnOrder.findIndex(
    (playerId) =>
      isAvailableForTurn(room, playerId) &&
      (!trick || isEligibleForCurrentPriorSet(trick, playerId))
  );
  return index >= 0 ? index : 0;
}

export function startTrick(room: Room, leaderId: string): void {
  const turnOrder = playerOrderStartingFrom(room, leaderId);
  const nextNumber = (room.trick?.trickNumber ?? room.trickHistory.length) + 1;
  const trick: TrickState = {
    trickNumber: nextNumber,
    leaderId,
    turnOrder,
    currentTurnIndex: 0,
    scoutedPlayerIds: [],
    plays: [],
    currentPlay: null,
    priorSetOwnerId: null,
  };
  trick.currentTurnIndex = firstAvailableTurnIndex(room, turnOrder, trick);
  room.trick = trick;
}

export function currentTurnPlayerId(trick: TrickState | null): string | null {
  if (!trick) return null;
  return trick.turnOrder[trick.currentTurnIndex] ?? null;
}

function findNextEligibleTurnIndex(room: Room, trick: TrickState): number | null {
  for (let step = 1; step <= trick.turnOrder.length; step++) {
    const index = (trick.currentTurnIndex + step) % trick.turnOrder.length;
    const playerId = trick.turnOrder[index];
    if (isAvailableForTurn(room, playerId) && isEligibleForCurrentPriorSet(trick, playerId)) {
      return index;
    }
  }
  return null;
}

function advanceTurn(room: Room, trick: TrickState): void {
  const nextIndex = findNextEligibleTurnIndex(room, trick);
  if (nextIndex !== null) trick.currentTurnIndex = nextIndex;
}

function opponentsOfPriorSet(trick: TrickState): string[] {
  const ownerId = trick.priorSetOwnerId;
  if (!ownerId) return [];
  return trick.turnOrder.filter((playerId) => playerId !== ownerId);
}

function allOtherPlayersScouted(room: Room, trick: TrickState): boolean {
  const opponents = opponentsOfPriorSet(trick);
  return (
    opponents.length > 0 &&
    opponents.every((id) => !isAvailableForTurn(room, id) || trick.scoutedPlayerIds.includes(id))
  );
}

function computeRoundScore(player: Player, endingPlayerId: string, reason: RoundEndReason): number {
  const gained = player.takenPile.length + player.scoutTokens;
  const handPenalty =
    reason === 'allScouted' && player.id === endingPlayerId ? 0 : player.row.length;
  return gained - handPenalty;
}

function finishRound(room: Room, endingPlayerId: string, reason: RoundEndReason): void {
  const scores: Record<string, number> = {};
  for (const playerId of room.playerOrder) {
    const player = room.players[playerId];
    const roundScore = computeRoundScore(player, endingPlayerId, reason);
    player.roundScore = roundScore;
    player.score += roundScore;
    scores[playerId] = roundScore;
  }

  room.roundHistory.unshift({
    roundNumber: room.roundNumber,
    endingPlayerId,
    reason,
    scores,
  });
  room.gameEndReason = reason;
  room.trick = null;

  if (room.roundNumber >= room.totalRounds) {
    finishGame(room, reason);
    return;
  }

  startNextRound(room);
}

export function finishGame(room: Room, reason: Room['gameEndReason'] = 'handEmpty'): void {
  const players = room.playerOrder.map((playerId) => room.players[playerId]);
  const bestScore = Math.max(...players.map((player) => player.score));
  room.winnerIds = players
    .filter((player) => player.score === bestScore)
    .map((player) => player.id);
  room.phase = 'ended';
  room.gameEndReason = reason;
}

function skipDisconnectedCurrentTurn(room: Room): boolean {
  let changed = false;

  while (room.phase === 'playing' && room.trick) {
    const trick = room.trick;
    const playerId = currentTurnPlayerId(trick);
    if (!playerId || isAvailableForTurn(room, playerId)) return changed;

    if (
      trick.priorSetOwnerId &&
      playerId !== trick.priorSetOwnerId &&
      !trick.scoutedPlayerIds.includes(playerId)
    ) {
      trick.scoutedPlayerIds.push(playerId);
      changed = true;
    }

    if (allOtherPlayersScouted(room, trick) && trick.priorSetOwnerId) {
      finishRound(room, trick.priorSetOwnerId, 'allScouted');
      return true;
    }

    const nextIndex = findNextEligibleTurnIndex(room, trick);
    if (nextIndex === null) return changed;
    trick.currentTurnIndex = nextIndex;
  }

  return changed;
}

export function handlePlayerDisconnected(room: Room): boolean {
  if (room.phase !== 'playing') return false;

  const initialTrick = room.trick;
  if (!room.trick) beginFirstTrickIfReady(room);

  const changed = room.trick !== initialTrick;
  if (!room.trick) return changed;

  if (allOtherPlayersScouted(room, room.trick) && room.trick.priorSetOwnerId) {
    finishRound(room, room.trick.priorSetOwnerId, 'allScouted');
    return true;
  }

  return skipDisconnectedCurrentTurn(room) || changed;
}

function commitPlay(room: Room, playerId: string, startIndex: number, count: number): void {
  const trick = room.trick;
  if (!trick) throw new Error('Trick has not started');
  if (currentTurnPlayerId(trick) !== playerId) throw new Error('Not your turn');
  if (!Number.isInteger(startIndex) || !Number.isInteger(count) || count <= 0) {
    throw new Error('Invalid card selection');
  }

  const player = room.players[playerId];
  if (!player || startIndex < 0 || startIndex + count > player.row.length) {
    throw new Error('Selected cards must be contiguous in your row');
  }

  const selected = player.row.slice(startIndex, startIndex + count);
  const play = summarizePlay(playerId, selected);
  if (trick.currentPlay && comparePlays(play, trick.currentPlay) <= 0) {
    throw new Error('Selected cards do not beat the current play');
  }

  if (trick.currentPlay) {
    player.takenPile.push(...trick.currentPlay.cards);
    room.trickHistory.unshift({
      trickNumber: trick.trickNumber,
      winnerId: playerId,
      cardCount: trick.currentPlay.cards.length,
      points: trick.currentPlay.cards.length,
    });
  }

  player.row.splice(startIndex, count);
  trick.currentPlay = play;
  trick.priorSetOwnerId = playerId;
  trick.plays = [play];
  trick.scoutedPlayerIds = [];

  if (player.row.length === 0) {
    finishRound(room, playerId, 'handEmpty');
    return;
  }

  advanceTurn(room, trick);
  skipDisconnectedCurrentTurn(room);
}

export function playCards(room: Room, playerId: string, startIndex: number, count: number): void {
  commitPlay(room, playerId, startIndex, count);
}

function currentPlayAfterRemovingCard(currentPlay: PlayedSet, cardId: string): PlayedSet | null {
  const index = currentPlay.cards.findIndex((card) => card.id === cardId);
  if (index < 0) throw new Error('Selected card is not in the current play');
  if (index !== 0 && index !== currentPlay.cards.length - 1) {
    throw new Error('You can only scout a card from either end of the prior set');
  }

  const remaining = currentPlay.cards.filter((card) => card.id !== cardId);
  return remaining.length > 0
    ? summarizePlay(currentPlay.playerId, remaining, currentPlay.id)
    : null;
}

function removeCardFromCurrentPlay(trick: TrickState, cardId: string): ScoutCard {
  const currentPlay = trick.currentPlay;
  if (!currentPlay) throw new Error('No prior set to scout from');
  const index = currentPlay.cards.findIndex((card) => card.id === cardId);
  if (index < 0) throw new Error('Selected card is not in the current play');
  if (index !== 0 && index !== currentPlay.cards.length - 1) {
    throw new Error('You can only scout a card from either end of the prior set');
  }

  const [removed] = currentPlay.cards.splice(index, 1);
  if (!removed) throw new Error('No scout card available');

  if (currentPlay.cards.length > 0) {
    const updated = summarizePlay(currentPlay.playerId, currentPlay.cards, currentPlay.id);
    trick.currentPlay = updated;
    trick.plays = [updated];
  } else {
    trick.currentPlay = null;
    trick.plays = [];
  }

  return removed;
}

export function passAndScout(
  room: Room,
  playerId: string,
  cardId: string,
  insertIndex: number,
  flip = false,
  thenPlay?: { startIndex: number; count: number }
): void {
  const trick = room.trick;
  if (!trick) throw new Error('Trick has not started');
  if (currentTurnPlayerId(trick) !== playerId) throw new Error('Not your turn');
  if (!trick.currentPlay || !trick.priorSetOwnerId) throw new Error('Leader must play cards');
  if (trick.priorSetOwnerId === playerId) throw new Error('You cannot scout your own prior set');
  if (trick.scoutedPlayerIds.includes(playerId)) throw new Error('Already scouted this prior set');
  if (!Number.isInteger(insertIndex)) throw new Error('Invalid insert position');

  const player = room.players[playerId];
  if (!player || insertIndex < 0 || insertIndex > player.row.length) {
    throw new Error('Invalid insert position');
  }

  const ownerId = trick.priorSetOwnerId;
  const currentAfterScout = currentPlayAfterRemovingCard(trick.currentPlay, cardId);
  const scoutedOriginal = trick.currentPlay.cards.find((card) => card.id === cardId);
  if (!scoutedOriginal) throw new Error('No scout card available');
  const scouted = flip ? flipCard(scoutedOriginal) : scoutedOriginal;

  if (thenPlay) {
    if (player.scoutAndShowTokens <= 0) throw new Error('No Scout & Show token remaining');
    const previewRow = [...player.row];
    previewRow.splice(insertIndex, 0, scouted);
    if (
      !Number.isInteger(thenPlay.startIndex) ||
      !Number.isInteger(thenPlay.count) ||
      thenPlay.count <= 0 ||
      thenPlay.startIndex < 0 ||
      thenPlay.startIndex + thenPlay.count > previewRow.length
    ) {
      throw new Error('Invalid Scout & Show card selection');
    }
    const selected = previewRow.slice(thenPlay.startIndex, thenPlay.startIndex + thenPlay.count);
    const play = summarizePlay(playerId, selected);
    if (currentAfterScout && comparePlays(play, currentAfterScout) <= 0) {
      throw new Error('Scout & Show cards do not beat the remaining prior set');
    }
  }

  removeCardFromCurrentPlay(trick, cardId);
  player.row.splice(insertIndex, 0, scouted);

  if (room.playerOrder.length > 2) {
    room.players[ownerId].scoutTokens += 1;
  }

  if (thenPlay) {
    player.scoutAndShowTokens -= 1;
    // Defensive: all commitPlay throw paths are pre-validated above, but if
    // commitPlay throws for an unexpected reason, roll back the scout mutation
    // so the prior set and player row are not left in an inconsistent state.
    try {
      commitPlay(room, playerId, thenPlay.startIndex, thenPlay.count);
    } catch (err) {
      // Roll back: remove the scouted card from the row and re-insert into current play
      player.row.splice(insertIndex, 1);
      trick.currentPlay = summarizePlay(ownerId, [
        ...(trick.currentPlay?.cards ?? []),
        scoutedOriginal,
      ]);
      trick.plays = [trick.currentPlay];
      throw err;
    }
    return;
  }

  trick.scoutedPlayerIds.push(playerId);

  if (allOtherPlayersScouted(room, trick) && trick.priorSetOwnerId) {
    finishRound(room, trick.priorSetOwnerId, 'allScouted');
    return;
  }

  advanceTurn(room, trick);
  skipDisconnectedCurrentTurn(room);
}

export function resetToLobby(room: Room): void {
  room.phase = 'lobby';
  room.showPile = [];
  room.trick = null;
  room.trickHistory = [];
  room.roundHistory = [];
  room.roundNumber = 0;
  room.totalRounds = 0;
  room.twoPlayerReserve = [];
  room.winnerIds = [];
  room.gameEndReason = null;
  for (const player of Object.values(room.players)) {
    player.row = [];
    player.takenPile = [];
    player.setupFlipped = false;
    player.setupConfirmed = false;
    player.score = 0;
    player.roundScore = 0;
    player.scoutTokens = 0;
    player.scoutAndShowTokens = 0;
  }
}
