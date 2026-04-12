import type { Room, RoundState, RoundPlayer } from '../../../core/src/types';
import type { Card, NumberCard } from '../../../core/src/deck';
import { buildDeck } from '../../../core/src/deck';
import { FLIP7_CARD_COUNT } from '../../../core/src/constants';
import { shuffle, draw } from './deckManager';
import { calculatePlayerRoundScore } from './scoreManager';

// ─── Round initialisation ─────────────────────────────────────────────────────

export function startRound(room: Room): void {
  const playerIds = Object.keys(room.players);
  const roundNumber = room.roundHistory.length + 1;

  // Rotate the dealer index.
  // First round: derive prevDealerIndex so that dealerIndex lands on the host,
  // making the host the first player to act (seated position 0 in turn order).
  const hostIndex = playerIds.findIndex((id) => id === room.hostId);
  const prevDealerIndex =
    room.currentRound?.dealerIndex ?? (hostIndex - 1 + playerIds.length) % playerIds.length;
  const dealerIndex = (prevDealerIndex + 1) % playerIds.length;

  // Turn order starts with the dealer
  const turnOrder = [...playerIds.slice(dealerIndex), ...playerIds.slice(0, dealerIndex)];

  const roundPlayers: Record<string, RoundPlayer> = {};
  for (const id of playerIds) {
    roundPlayers[id] = {
      playerId: id,
      status: 'active',
      numberCards: [],
      modifierAdds: [],
      hasX2: false,
      hasSecondChance: false,
      flipThreeRemaining: 0,
    };
  }

  const deck = shuffle(buildDeck());

  room.currentRound = {
    roundNumber,
    dealerIndex,
    turnOrder,
    currentTurnIndex: 0,
    deck,
    discard: [],
    players: roundPlayers,
    pendingAction: null,
    roundEndReason: null,
    flip7PlayerId: null,
  };
}

// ─── Turn helpers ─────────────────────────────────────────────────────────────

function getCurrentTurnPlayerId(round: RoundState): string | null {
  return round.turnOrder[round.currentTurnIndex] ?? null;
}

function getActivePlayers(round: RoundState): string[] {
  return round.turnOrder.filter((id) => round.players[id]?.status === 'active');
}

function getNextActiveIndex(round: RoundState, fromIndex: number): number | null {
  const total = round.turnOrder.length;
  for (let i = 1; i <= total; i++) {
    const idx = (fromIndex + i) % total;
    const pid = round.turnOrder[idx];
    if (round.players[pid]?.status === 'active') {
      return idx;
    }
  }
  return null;
}

/**
 * After a turn action resolves, advance to the next active player.
 * If nobody is active, finalize the round.
 * Returns true if round was finalized.
 */
function advanceTurnOrFinalize(room: Room): boolean {
  const round = room.currentRound!;

  // If the current player is in the middle of a Flip Three, continue with them
  const currentId = getCurrentTurnPlayerId(round);
  if (currentId && round.players[currentId]?.flipThreeRemaining > 0) {
    // Stay on current player — they still need forced draws
    return false;
  }

  const active = getActivePlayers(round);
  if (active.length === 0) {
    finalizeRound(room);
    return true;
  }

  const nextIdx = getNextActiveIndex(round, round.currentTurnIndex);
  if (nextIdx === null) {
    finalizeRound(room);
    return true;
  }

  round.currentTurnIndex = nextIdx;
  return false;
}

// ─── Core game actions ────────────────────────────────────────────────────────

/**
 * Apply a drawn number card to the current player's state.
 * Handles: bust, second-chance save, Flip 7 trigger.
 */
function applyNumberCard(room: Room, playerId: string, card: NumberCard): void {
  const round = room.currentRound!;
  const rp = round.players[playerId];
  if (!rp) return;

  if (rp.numberCards.includes(card.value)) {
    // Duplicate number
    if (rp.hasSecondChance) {
      // Second Chance saves the player — discard duplicate, consume the token
      rp.hasSecondChance = false;
      round.discard.push(card);
      // If mid-Flip Three, the duplicate draw still consumed one of the three
      if (rp.flipThreeRemaining > 0) {
        rp.flipThreeRemaining--;
      }
      advanceTurnOrFinalize(room);
    } else {
      // Bust
      rp.status = 'busted';
      round.discard.push(card);
      rp.flipThreeRemaining = 0; // Stop any ongoing Flip Three for this player
      advanceTurnOrFinalize(room);
    }
  } else {
    // Unique number
    rp.numberCards.push(card.value);
    round.discard.push(card);

    if (rp.flipThreeRemaining > 0) {
      rp.flipThreeRemaining--;
    }

    if (rp.numberCards.length === FLIP7_CARD_COUNT) {
      // Flip 7 triggered — round ends immediately
      round.roundEndReason = 'flip7';
      round.flip7PlayerId = playerId;
      finalizeRound(room);
    } else {
      advanceTurnOrFinalize(room);
    }
  }
}

/**
 * Open a pending action state. If the drawing player is the only active player,
 * auto-target self (rules: must play on self if no other active players).
 */
function openPendingAction(
  room: Room,
  drawerId: string,
  action: 'freeze' | 'flipThree' | 'secondChance',
  drawnCard: Card
): void {
  const round = room.currentRound!;
  round.discard.push(drawnCard);

  const active = getActivePlayers(round).filter((id) => id !== drawerId);
  const eligible = active.length > 0 ? active : [drawerId];

  // Auto-resolve if only one eligible target (including self-only case)
  if (eligible.length === 1) {
    resolveAction(room, drawerId, eligible[0], action);
    return;
  }

  round.pendingAction = {
    drawerId,
    action,
    eligibleTargets: eligible,
  };
  // Also include drawer in eligible (rules allow self-targeting)
  round.pendingAction.eligibleTargets = [drawerId, ...active];
}

/**
 * Execute the action against the chosen target.
 * Called either from auto-resolve or from the chooseActionTarget handler.
 */
function resolveAction(
  room: Room,
  drawerId: string,
  targetId: string,
  action: 'freeze' | 'flipThree' | 'secondChance'
): void {
  const round = room.currentRound!;
  round.pendingAction = null;

  const rp = round.players[targetId];
  if (!rp) return;

  if (action === 'freeze') {
    rp.status = 'stayed';
    // Always advance turn after freeze — drawer used their draw action slot.
    // advanceTurnOrFinalize handles the case where target was the current player
    // (now stayed) and finds the next active player, or finalizes if none remain.
    advanceTurnOrFinalize(room);
  } else if (action === 'flipThree') {
    rp.flipThreeRemaining = 3;
    // Set current turn to target so their forced draws happen next
    const targetIdx = round.turnOrder.indexOf(targetId);
    if (targetIdx !== -1) round.currentTurnIndex = targetIdx;
    // The forced draws are processed via subsequent hit() calls from the server loop
    // (or the client will see flipThreeRemaining > 0 and the server will auto-draw)
  } else if (action === 'secondChance') {
    if (rp.hasSecondChance) {
      // Target already has one — the card is effectively wasted (discard it),
      // then advance turn
      advanceTurnOrFinalize(room);
    } else {
      rp.hasSecondChance = true;
      // After giving Second Chance, continue turn normally
      advanceTurnOrFinalize(room);
    }
  }
}

/**
 * Process a card drawn as part of a Flip Three forced draw.
 * Returns whether the round ended.
 */
function processFlipThreeDraw(room: Room, playerId: string, card: Card): boolean {
  const round = room.currentRound!;
  const rp = round.players[playerId];
  if (!rp) return false;

  if (card.kind === 'number') {
    applyNumberCard(room, playerId, card);
    return round.roundEndReason !== null;
  }

  if (card.kind === 'modifierAdd') {
    rp.modifierAdds.push(card.bonus);
    rp.flipThreeRemaining--;
    round.discard.push(card);
    if (rp.flipThreeRemaining === 0) {
      advanceTurnOrFinalize(room);
    }
    return false;
  }

  if (card.kind === 'modifierX2') {
    rp.hasX2 = true;
    rp.flipThreeRemaining--;
    round.discard.push(card);
    if (rp.flipThreeRemaining === 0) {
      advanceTurnOrFinalize(room);
    }
    return false;
  }

  if (card.kind === 'action') {
    // Action card drawn during Flip Three: counts as one of the three AND executes
    rp.flipThreeRemaining--;
    openPendingAction(room, playerId, card.action, card);
    return false;
  }

  return false;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function playerHit(room: Room, playerId: string): void {
  const round = room.currentRound;
  if (!round || round.roundEndReason !== null) return;
  if (round.pendingAction) return;

  const currentId = getCurrentTurnPlayerId(round);
  const rp = round.players[playerId];
  if (!rp || rp.status !== 'active') return;

  // Normal turn: must be current player
  // Flip Three turn: must be the player with remaining forced draws
  const isNormalTurn = playerId === currentId && rp.flipThreeRemaining === 0;
  const isFlipThreeTurn = rp.flipThreeRemaining > 0 && playerId === currentId;
  if (!isNormalTurn && !isFlipThreeTurn) return;

  const card = draw(round);

  if (rp.flipThreeRemaining > 0) {
    processFlipThreeDraw(room, playerId, card);
    return;
  }

  // Normal hit
  if (card.kind === 'number') {
    applyNumberCard(room, playerId, card);
  } else if (card.kind === 'modifierAdd') {
    rp.modifierAdds.push(card.bonus);
    round.discard.push(card);
    advanceTurnOrFinalize(room);
  } else if (card.kind === 'modifierX2') {
    rp.hasX2 = true;
    round.discard.push(card);
    advanceTurnOrFinalize(room);
  } else if (card.kind === 'action') {
    openPendingAction(room, playerId, card.action, card);
  }
}

export function playerStay(room: Room, playerId: string): void {
  const round = room.currentRound;
  if (!round || round.roundEndReason !== null) return;
  if (round.pendingAction) return;

  const currentId = getCurrentTurnPlayerId(round);
  if (playerId !== currentId) return;

  const rp = round.players[playerId];
  if (!rp || rp.status !== 'active') return;
  if (rp.flipThreeRemaining > 0) return; // Cannot stay during Flip Three

  rp.status = 'stayed';
  advanceTurnOrFinalize(room);
}

export function chooseActionTarget(room: Room, drawerId: string, targetId: string): void {
  const round = room.currentRound;
  if (!round || round.roundEndReason !== null) return;

  const pa = round.pendingAction;
  if (!pa || pa.drawerId !== drawerId) return;
  if (!pa.eligibleTargets.includes(targetId)) return;

  const targetRp = round.players[targetId];
  if (!targetRp || targetRp.status !== 'active') return;

  resolveAction(room, drawerId, targetId, pa.action);
}

export function finalizeRound(room: Room): void {
  const round = room.currentRound;
  if (!round) return;

  const scores: Record<string, number> = {};
  for (const [id, rp] of Object.entries(round.players)) {
    const isFlip7Winner = round.flip7PlayerId === id;
    const earned = calculatePlayerRoundScore(rp, isFlip7Winner);
    scores[id] = earned;
    const player = room.players[id];
    if (player) {
      player.totalScore += earned;
    }
  }

  room.roundHistory.push({
    roundNumber: round.roundNumber,
    scores,
    flip7PlayerId: round.flip7PlayerId,
  });

  // Set round end reason if not already set
  if (!round.roundEndReason) {
    round.roundEndReason = 'allDone';
  }
}

export function getCurrentTurnPlayer(room: Room): string | null {
  if (!room.currentRound) return null;
  return getCurrentTurnPlayerId(room.currentRound);
}

/**
 * Determine winners after finalizeRound has run.
 * Returns playerIds of all players who reached targetScore.
 * If multiple are tied at the top (all >= target), we play another round.
 */
export function computeWinners(room: Room): string[] {
  const target = room.targetScore;
  const qualified = Object.values(room.players).filter((p) => p.totalScore >= target);
  if (qualified.length === 0) return [];

  const maxScore = Math.max(...qualified.map((p) => p.totalScore));
  const winners = qualified.filter((p) => p.totalScore === maxScore);

  // If only one player has the max score, they win
  if (winners.length === 1) return [winners[0].id];

  // Tie at the top → play another round (return empty to signal "no clear winner yet")
  return [];
}
