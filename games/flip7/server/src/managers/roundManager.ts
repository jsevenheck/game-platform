import type { Room, RoundState, RoundPlayer } from '../../../core/src/types';
import type { Card, NumberCard } from '../../../core/src/deck';
import { buildDeck } from '../../../core/src/deck';
import { FLIP7_CARD_COUNT } from '../../../core/src/constants';
import { shuffle, draw } from './deckManager';
import { calculatePlayerRoundScore } from './scoreManager';

// ─── Action-resolution side-channel ──────────────────────────────────────────
// Socket handlers read this after each hit / chooseActionTarget call so they
// can broadcast the outcome to every player without changing function signatures.

type ResolvedActionRecord = {
  drawerId: string;
  action: 'freeze' | 'flipThree' | 'secondChance';
  targetId: string;
};

const _resolvedActions = new Map<string, ResolvedActionRecord>();

/** Consume and return the last action resolved for a room (if any). */
export function popResolvedAction(roomCode: string): ResolvedActionRecord | undefined {
  const record = _resolvedActions.get(roomCode);
  _resolvedActions.delete(roomCode);
  return record;
}

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
      deferredActions: [],
      lastDrawnCard: null,
    };
  }

  const deck = shuffle(buildDeck());

  room.currentRound = {
    roundNumber,
    phase: 'initialDeal',
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

  // Run the initial deal phase — deals one card to each player.
  // May pause if an action card requires target selection (pendingAction).
  continueInitialDeal(room);
}

// ─── Initial deal phase ───────────────────────────────────────────────────────

/**
 * A player needs an initial card if they are active but have no number cards,
 * no modifier cards, and no x2 — i.e. a completely empty hand.
 */
function playerNeedsInitialCard(rp: RoundPlayer): boolean {
  if (rp.status !== 'active') return false; // frozen/busted = considered dealt
  return rp.numberCards.length === 0 && rp.modifierAdds.length === 0 && !rp.hasX2;
}

/**
 * Drive the initial deal phase. Deals one card to each player in turn order.
 * If an action card is drawn, it is resolved immediately (may pause for target
 * selection). Continues until every player has ≥1 card in hand or is frozen.
 */
export function continueInitialDeal(room: Room): void {
  const round = room.currentRound!;

  while (true) {
    if (round.phase !== 'initialDeal') return;
    if (round.pendingAction) return; // waiting for target selection
    if (round.roundEndReason) return;

    // 1. Handle any pending Flip Three forced draws
    let handledFlipThree = false;
    for (const pid of round.turnOrder) {
      const rp = round.players[pid];
      if (rp.status === 'active' && rp.flipThreeRemaining > 0) {
        round.currentTurnIndex = round.turnOrder.indexOf(pid);
        const card = draw(round);
        processFlipThreeDraw(room, pid, card);
        handledFlipThree = true;
        break; // re-check loop conditions
      }
    }
    if (handledFlipThree) continue;

    // 2. Handle deferred actions (action cards set aside during Flip Three)
    let handledDeferred = false;
    for (const pid of round.turnOrder) {
      const rp = round.players[pid];
      if (rp && rp.status !== 'busted' && rp.deferredActions.length > 0) {
        const next = rp.deferredActions.shift()!;
        const idx = round.turnOrder.indexOf(pid);
        round.currentTurnIndex = idx;
        openPendingAction(room, pid, next.action, next.card);
        handledDeferred = true;
        break;
      }
    }
    if (handledDeferred) continue;

    // 3. Check if the initial deal is complete
    const allDealt = round.turnOrder.every((id) => !playerNeedsInitialCard(round.players[id]));
    if (allDealt) {
      round.phase = 'playing';
      // Set turn to first active player in turn order
      round.currentTurnIndex = 0;
      if (round.players[round.turnOrder[0]]?.status !== 'active') {
        const next = getNextActiveIndex(round, round.turnOrder.length - 1);
        if (next !== null) round.currentTurnIndex = next;
      }
      return;
    }

    // 4. Deal to the next player who needs a card (in turn order)
    let dealt = false;
    for (const pid of round.turnOrder) {
      const rp = round.players[pid];
      if (!playerNeedsInitialCard(rp)) continue;

      const idx = round.turnOrder.indexOf(pid);
      round.currentTurnIndex = idx;
      const card = draw(round);
      rp.lastDrawnCard = card;

      if (card.kind === 'number') {
        // No bust possible (first card), no Flip 7 (1 card)
        rp.numberCards.push(card.value);
        round.discard.push(card);
        dealt = true;
        break;
      } else if (card.kind === 'modifierAdd') {
        rp.modifierAdds.push(card.bonus);
        round.discard.push(card);
        dealt = true;
        break;
      } else if (card.kind === 'modifierX2') {
        rp.hasX2 = true;
        round.discard.push(card);
        dealt = true;
        break;
      } else if (card.kind === 'action') {
        // Resolve action immediately — may set pendingAction
        openPendingAction(room, pid, card.action, card);
        dealt = true;
        break;
      }
    }

    if (!dealt) break; // safety: no eligible player found (shouldn't happen)
  }
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

  // During initial deal, the deal loop drives advancement — do nothing here.
  if (round.phase === 'initialDeal') {
    return false;
  }

  // If the current player is in the middle of a Flip Three, continue with them
  const currentId = getCurrentTurnPlayerId(round);
  if (currentId && round.players[currentId]?.flipThreeRemaining > 0) {
    // Stay on current player — they still need forced draws
    return false;
  }

  // Process deferred actions (action cards set aside during Flip Three)
  // before advancing the turn — they belong to the player who drew them.
  for (const pid of round.turnOrder) {
    const rp = round.players[pid];
    if (rp && rp.status !== 'busted' && rp.deferredActions.length > 0 && !round.roundEndReason) {
      const pidIdx = round.turnOrder.indexOf(pid);
      if (pidIdx !== -1) round.currentTurnIndex = pidIdx;
      const next = rp.deferredActions.shift()!;
      openPendingAction(room, pid, next.action, next.card);
      return false;
    }
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

  // Always record the drawn card so the client can reveal it before
  // applying dramatic state changes (bust / secondChance save).
  rp.lastDrawnCard = card;

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
      rp.flipThreeRemaining = 0;
      rp.deferredActions = []; // Clear deferred actions on bust
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
      rp.deferredActions = []; // Clear deferred actions on Flip 7
      finalizeRound(room);
    } else {
      advanceTurnOrFinalize(room);
    }
  }
}

/**
 * Open a pending action state.
 *
 * Fix 5: Freeze allows self-targeting. Flip Three and Second Chance cannot
 * target the drawer. If no valid target exists for Flip Three / Second Chance
 * the card is simply discarded.
 */
function openPendingAction(
  room: Room,
  drawerId: string,
  action: 'freeze' | 'flipThree' | 'secondChance',
  drawnCard: Card
): void {
  const round = room.currentRound!;
  round.discard.push(drawnCard);

  const otherActive = getActivePlayers(round).filter((id) => id !== drawerId);

  let eligible: string[];
  if (action === 'freeze') {
    // Freeze: self-targeting allowed per official rules
    eligible = [drawerId, ...otherActive];
  } else {
    // Flip Three and Second Chance: cannot target yourself
    eligible = otherActive;
  }

  // No valid targets → discard without effect
  if (eligible.length === 0) {
    advanceTurnOrFinalize(room);
    return;
  }

  // Auto-resolve if only one eligible target
  if (eligible.length === 1) {
    resolveAction(room, drawerId, eligible[0], action);
    return;
  }

  round.pendingAction = {
    drawerId,
    action,
    eligibleTargets: eligible,
  };
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

  // Record so the socket handler can broadcast the outcome.
  _resolvedActions.set(room.code, { drawerId, action, targetId });

  const rp = round.players[targetId];
  if (!rp) return;

  if (action === 'freeze') {
    rp.status = 'stayed';
    advanceTurnOrFinalize(room);
  } else if (action === 'flipThree') {
    rp.flipThreeRemaining = 3;
    // Set current turn to target so their forced draws happen next.
    const targetIdx = round.turnOrder.indexOf(targetId);
    if (targetIdx !== -1) round.currentTurnIndex = targetIdx;
    // This does not auto-draw cards by itself; the forced draws are only
    // consumed when subsequent hit() handling processes flipThreeRemaining.
  } else if (action === 'secondChance') {
    // Fix 3: If the target already holds a Second Chance, pass it to another
    // active player who doesn't have one. Only discard if no recipient exists.
    if (!rp.hasSecondChance) {
      rp.hasSecondChance = true;
    } else {
      // Target already has one — find another active player without one
      const recipient = getActivePlayers(round).find(
        (id) => id !== targetId && !round.players[id].hasSecondChance
      );
      if (recipient) {
        round.players[recipient].hasSecondChance = true;
      }
      // else: no eligible recipient — card is simply discarded
    }
    advanceTurnOrFinalize(room);
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
    // Fix 4: Defer action cards drawn during Flip Three — resolve after all 3
    // draws complete (unless the player busted or triggered Flip 7 first).
    rp.lastDrawnCard = card;
    rp.flipThreeRemaining--;
    rp.deferredActions.push({ action: card.action, card });
    // Card is NOT discarded yet — openPendingAction will discard it when the
    // deferred action is eventually processed.

    if (rp.flipThreeRemaining === 0 && round.roundEndReason === null) {
      // All 3 draws complete — process deferred actions via advanceTurnOrFinalize
      advanceTurnOrFinalize(room);
    }
    return false;
  }

  return false;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function playerHit(room: Room, playerId: string): void {
  const round = room.currentRound;
  if (!round || round.roundEndReason !== null) return;
  if (round.phase === 'initialDeal') return; // Reject during initial deal
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
  if (round.phase === 'initialDeal') return; // Reject during initial deal
  if (round.pendingAction) return;

  const currentId = getCurrentTurnPlayerId(round);
  if (playerId !== currentId) return;

  const rp = round.players[playerId];
  if (!rp || rp.status !== 'active') return;
  if (rp.flipThreeRemaining > 0) return; // Cannot stay during Flip Three

  // Must hit with 0 cards — a player with a completely empty hand cannot stay
  if (rp.numberCards.length === 0 && rp.modifierAdds.length === 0 && !rp.hasX2) {
    return;
  }

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

  // During initial deal, continue the deal after action resolution
  if (round.phase === 'initialDeal' && !round.pendingAction && !round.roundEndReason) {
    continueInitialDeal(room);
  }
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
