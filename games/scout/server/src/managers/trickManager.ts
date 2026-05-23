import { nanoid } from 'nanoid';
import { buildDeck, flipCard, type ScoutCard } from '../../../core/src/deck';
import type { PlayedSet, Player, Room, TrickState } from '../../../core/src/types';

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function summarizePlay(playerId: string, cards: ScoutCard[]): PlayedSet {
  return {
    id: nanoid(10),
    playerId,
    cards,
    sum: cards.reduce((total, card) => total + card.playValue, 0),
    count: cards.length,
    highCard: Math.max(...cards.map((card) => card.playValue)),
  };
}

export function comparePlays(
  candidate: Pick<PlayedSet, 'sum' | 'count' | 'highCard'>,
  current: Pick<PlayedSet, 'sum' | 'count' | 'highCard'>
): number {
  if (candidate.sum !== current.sum) return candidate.sum - current.sum;
  if (candidate.count !== current.count) return candidate.count - current.count;
  return candidate.highCard - current.highCard;
}

export function beatsCurrentPlay(cards: ScoutCard[], current: PlayedSet | null): boolean {
  if (!current) return cards.length > 0;
  return comparePlays(summarizePlay('candidate', cards), current) > 0;
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
  return room.playerOrder.every((playerId) => room.players[playerId]?.setupConfirmed);
}

export function startGame(room: Room): void {
  const deck = shuffle(buildDeck());
  const order = [...room.playerOrder];
  const handSize = Math.floor(deck.length / order.length);

  for (const playerId of order) {
    const player = room.players[playerId];
    player.row = deck.splice(0, handSize);
    player.takenPile = [];
    player.setupFlipped = false;
    player.setupConfirmed = false;
    player.score = 0;
  }

  room.showPile = deck;
  room.trick = null;
  room.trickHistory = [];
  room.winnerIds = [];
  room.gameEndReason = null;
  room.phase = 'playing';
}

export function beginFirstTrickIfReady(room: Room): void {
  if (room.phase !== 'playing' || room.trick || !setupComplete(room)) return;
  const leaderId = room.hostId ?? room.playerOrder[0];
  startTrick(room, leaderId);
}

export function startTrick(room: Room, leaderId: string): void {
  const leaderIndex = Math.max(0, room.playerOrder.indexOf(leaderId));
  const turnOrder = [
    ...room.playerOrder.slice(leaderIndex),
    ...room.playerOrder.slice(0, leaderIndex),
  ];
  const nextNumber = (room.trick?.trickNumber ?? room.trickHistory.length) + 1;
  room.trick = {
    trickNumber: nextNumber,
    leaderId,
    turnOrder,
    currentTurnIndex: 0,
    passedPlayerIds: [],
    plays: [],
    currentPlay: null,
  };
}

export function currentTurnPlayerId(trick: TrickState | null): string | null {
  if (!trick) return null;
  return trick.turnOrder[trick.currentTurnIndex] ?? null;
}

function advanceTurn(trick: TrickState): void {
  for (let step = 1; step <= trick.turnOrder.length; step++) {
    const index = (trick.currentTurnIndex + step) % trick.turnOrder.length;
    const playerId = trick.turnOrder[index];
    if (!trick.passedPlayerIds.includes(playerId)) {
      trick.currentTurnIndex = index;
      return;
    }
  }
}

function activePlayerCount(trick: TrickState): number {
  return trick.turnOrder.length - trick.passedPlayerIds.length;
}

function collectCardsFromTrick(trick: TrickState): ScoutCard[] {
  return trick.plays.flatMap((play) => play.cards);
}

function computeScore(player: Player): number {
  return player.takenPile.reduce((total, card) => total + card.scoutPoints, 0);
}

export function finishGame(room: Room, reason: Room['gameEndReason'] = 'rowEmpty'): void {
  for (const player of Object.values(room.players)) {
    player.score = computeScore(player);
  }

  const sorted = [...room.playerOrder]
    .map((playerId) => room.players[playerId])
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.takenPile.length !== a.takenPile.length) return b.takenPile.length - a.takenPile.length;
      const highA = Math.max(0, ...a.takenPile.map((card) => card.scoutPoints));
      const highB = Math.max(0, ...b.takenPile.map((card) => card.scoutPoints));
      return highB - highA;
    });
  const best = sorted[0];
  room.winnerIds = sorted
    .filter((player) => {
      if (!best) return false;
      const high = Math.max(0, ...player.takenPile.map((card) => card.scoutPoints));
      const bestHigh = Math.max(0, ...best.takenPile.map((card) => card.scoutPoints));
      return (
        player.score === best.score &&
        player.takenPile.length === best.takenPile.length &&
        high === bestHigh
      );
    })
    .map((player) => player.id);
  room.phase = 'ended';
  room.gameEndReason = reason;
}

function resolveTrick(room: Room): string {
  const trick = room.trick;
  if (!trick?.currentPlay) throw new Error('No current play to resolve');
  const winnerId = trick.currentPlay.playerId;
  const cards = collectCardsFromTrick(trick);
  const winner = room.players[winnerId];
  winner.takenPile.push(...cards);
  const points = cards.reduce((total, card) => total + card.scoutPoints, 0);
  room.trickHistory.unshift({
    trickNumber: trick.trickNumber,
    winnerId,
    cardCount: cards.length,
    points,
  });

  if (winner.row.length === 0) {
    room.trick = null;
    finishGame(room, 'rowEmpty');
    return winnerId;
  }

  startTrick(room, winnerId);
  return winnerId;
}

export function playCards(room: Room, playerId: string, startIndex: number, count: number): void {
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

  player.row.splice(startIndex, count);
  trick.plays.push(play);
  trick.currentPlay = play;
  trick.passedPlayerIds = trick.passedPlayerIds.filter((id) => id !== playerId);

  if (player.row.length === 0) {
    // Award the in-progress table to the player who emptied their row, then end.
    player.takenPile.push(...collectCardsFromTrick(trick));
    room.trickHistory.unshift({
      trickNumber: trick.trickNumber,
      winnerId: playerId,
      cardCount: collectCardsFromTrick(trick).length,
      points: collectCardsFromTrick(trick).reduce((total, card) => total + card.scoutPoints, 0),
    });
    room.trick = null;
    finishGame(room, 'rowEmpty');
    return;
  }

  advanceTurn(trick);
}

function removeCardFromTable(
  trick: TrickState,
  cardId?: string,
  fromPlayerId?: string
): ScoutCard | null {
  for (const play of trick.plays) {
    if (fromPlayerId && play.playerId !== fromPlayerId) continue;
    const index = cardId ? play.cards.findIndex((card) => card.id === cardId) : 0;
    if (index >= 0) {
      return play.cards.splice(index, 1)[0] ?? null;
    }
  }
  return null;
}

export function passAndScout(
  room: Room,
  playerId: string,
  source: 'showPile' | 'table',
  side: 'left' | 'right',
  cardId?: string,
  fromPlayerId?: string
): void {
  const trick = room.trick;
  if (!trick) throw new Error('Trick has not started');
  if (currentTurnPlayerId(trick) !== playerId) throw new Error('Not your turn');
  if (!trick.currentPlay) throw new Error('Leader must play cards');
  if (trick.passedPlayerIds.includes(playerId)) throw new Error('Already passed this trick');

  let scouted: ScoutCard | null = null;
  if (source === 'showPile') {
    const index = cardId ? room.showPile.findIndex((card) => card.id === cardId) : 0;
    if (index >= 0) scouted = room.showPile.splice(index, 1)[0] ?? null;
  } else {
    scouted = removeCardFromTable(trick, cardId, fromPlayerId);
  }

  if (!scouted) throw new Error('No scout card available from that source');

  const player = room.players[playerId];
  if (side === 'left') player.row.unshift(scouted);
  else player.row.push(scouted);

  trick.passedPlayerIds.push(playerId);

  if (activePlayerCount(trick) <= 1) {
    resolveTrick(room);
    return;
  }

  advanceTurn(trick);
}

export function resetToLobby(room: Room): void {
  room.phase = 'lobby';
  room.showPile = [];
  room.trick = null;
  room.trickHistory = [];
  room.winnerIds = [];
  room.gameEndReason = null;
  for (const player of Object.values(room.players)) {
    player.row = [];
    player.takenPile = [];
    player.setupFlipped = false;
    player.setupConfirmed = false;
    player.score = 0;
  }
}
