import {
  startRound,
  playerHit,
  playerStay,
  chooseActionTarget,
  finalizeRound,
  computeWinners,
} from '../server/src/managers/roundManager';
import type { Room } from '../core/src/types';
import type { Card } from '../core/src/deck';

/** Deterministic deck where draw always returns the next card in the list */
function injectDeck(room: Room, cards: Card[]) {
  // deck is LIFO (pop from end) — reverse the list so first draw returns cards[0]
  room.currentRound!.deck = [...cards].reverse();
  room.currentRound!.discard = [];
}

function makeRoom(playerIds: string[]): Room {
  return {
    code: 'TEST',
    ownerId: playerIds[0],
    hostId: playerIds[0],
    phase: 'playing',
    players: Object.fromEntries(
      playerIds.map((id, i) => [
        id,
        {
          id,
          name: `Player ${i + 1}`,
          resumeToken: `token-${id}`,
          totalScore: 0,
          connected: true,
          isHost: i === 0,
          socketId: null,
        },
      ])
    ),
    targetScore: 200,
    currentRound: null,
    roundHistory: [],
    winnerIds: [],
  };
}

/**
 * Call startRound then fast-forward past the initial deal to a clean 'playing'
 * state with empty player hands. Use this for tests that need deterministic
 * post-deal state — the round structure (turnOrder, roundNumber, dealerIndex)
 * is preserved from startRound, only phase/player state is normalised.
 */
function startRoundReady(room: Room) {
  startRound(room);
  const round = room.currentRound!;
  round.phase = 'playing';
  round.pendingAction = null;
  round.currentTurnIndex = 0;
  for (const rp of Object.values(round.players)) {
    rp.status = 'active';
    rp.numberCards = [];
    rp.modifierAdds = [];
    rp.hasX2 = false;
    rp.hasSecondChance = false;
    rp.flipThreeRemaining = 0;
    rp.deferredActions = [];
    rp.lastDrawnCard = null;
  }
}

describe('startRound', () => {
  it('initializes a round with correct structure and all players registered', () => {
    const room = makeRoom(['p1', 'p2', 'p3']);
    startRound(room);
    expect(room.currentRound).not.toBeNull();
    const round = room.currentRound!;
    expect(round.roundNumber).toBe(1);
    expect(round.turnOrder).toHaveLength(3);
    expect(Object.keys(round.players)).toHaveLength(3);
    // After the initial deal every player should be active or frozen (stayed)
    for (const rp of Object.values(round.players)) {
      expect(['active', 'stayed']).toContain(rp.status);
    }
  });

  it('conserves all 94 cards across deck, discard, and deferred actions', () => {
    const room = makeRoom(['p1', 'p2']);
    startRound(room);
    const round = room.currentRound!;
    // Cards drawn during the initial deal move to discard (or deferredActions
    // if a Flip Three produced action cards still awaiting resolution).
    const deferredCount = Object.values(round.players).reduce(
      (sum, rp) => sum + rp.deferredActions.length,
      0
    );
    expect(round.deck.length + round.discard.length + deferredCount).toBe(94);
  });
});

describe('playerHit + playerStay', () => {
  it('adds unique number card to player hand', () => {
    const room = makeRoom(['p1', 'p2', 'p3']);
    startRoundReady(room);
    injectDeck(room, [{ kind: 'number', value: 5 }]);

    playerHit(room, 'p1');
    expect(room.currentRound!.players['p1'].numberCards).toContain(5);
  });

  it('advances turn after hit', () => {
    const room = makeRoom(['p1', 'p2', 'p3']);
    startRoundReady(room);
    injectDeck(room, [{ kind: 'number', value: 5 }]);

    const initialTurnIdx = room.currentRound!.currentTurnIndex;
    playerHit(room, room.currentRound!.turnOrder[initialTurnIdx]);
    expect(room.currentRound!.currentTurnIndex).not.toBe(initialTurnIdx);
  });

  it('player can stay and status becomes stayed', () => {
    const room = makeRoom(['p1', 'p2', 'p3']);
    startRoundReady(room);
    const currentId = room.currentRound!.turnOrder[0];
    // Give the player a card — a player with an empty hand must hit
    room.currentRound!.players[currentId].numberCards = [1];

    playerStay(room, currentId);
    expect(room.currentRound!.players[currentId].status).toBe('stayed');
  });

  it('player with empty hand cannot stay (must hit)', () => {
    const room = makeRoom(['p1', 'p2', 'p3']);
    startRoundReady(room);
    const currentId = room.currentRound!.turnOrder[0];

    // Hand is empty after startRoundReady — stay should be rejected
    playerStay(room, currentId);
    expect(room.currentRound!.players[currentId].status).toBe('active');
  });

  it('player busts on duplicate number', () => {
    const room = makeRoom(['p1', 'p2', 'p3']);
    startRoundReady(room);
    room.currentRound!.players['p1'].numberCards = [5];
    injectDeck(room, [{ kind: 'number', value: 5 }]);

    room.currentRound!.currentTurnIndex = room.currentRound!.turnOrder.indexOf('p1');
    playerHit(room, 'p1');
    expect(room.currentRound!.players['p1'].status).toBe('busted');
  });

  it('second chance prevents bust on duplicate', () => {
    const room = makeRoom(['p1', 'p2', 'p3']);
    startRoundReady(room);
    room.currentRound!.players['p1'].numberCards = [5];
    room.currentRound!.players['p1'].hasSecondChance = true;
    injectDeck(room, [{ kind: 'number', value: 5 }]);

    room.currentRound!.currentTurnIndex = room.currentRound!.turnOrder.indexOf('p1');
    playerHit(room, 'p1');
    expect(room.currentRound!.players['p1'].status).toBe('active');
    expect(room.currentRound!.players['p1'].hasSecondChance).toBe(false);
  });

  it('x2 modifier card sets hasX2', () => {
    const room = makeRoom(['p1', 'p2', 'p3']);
    startRoundReady(room);
    injectDeck(room, [{ kind: 'modifierX2' }]);

    room.currentRound!.currentTurnIndex = room.currentRound!.turnOrder.indexOf('p1');
    playerHit(room, 'p1');
    expect(room.currentRound!.players['p1'].hasX2).toBe(true);
  });

  it('modifierAdd card accumulates bonus', () => {
    const room = makeRoom(['p1', 'p2', 'p3']);
    startRoundReady(room);
    injectDeck(room, [{ kind: 'modifierAdd', bonus: 8 }]);

    room.currentRound!.currentTurnIndex = room.currentRound!.turnOrder.indexOf('p1');
    playerHit(room, 'p1');
    expect(room.currentRound!.players['p1'].modifierAdds).toContain(8);
  });
});

describe('Flip 7', () => {
  it('triggers when a player collects 7 unique number cards', () => {
    const room = makeRoom(['p1', 'p2', 'p3']);
    startRoundReady(room);
    // Give p1 six unique cards
    room.currentRound!.players['p1'].numberCards = [1, 2, 3, 4, 5, 6];
    injectDeck(room, [{ kind: 'number', value: 7 }]);

    room.currentRound!.currentTurnIndex = room.currentRound!.turnOrder.indexOf('p1');
    playerHit(room, 'p1');

    expect(room.currentRound!.roundEndReason).toBe('flip7');
    expect(room.currentRound!.flip7PlayerId).toBe('p1');
  });

  it('ends round immediately on Flip 7', () => {
    const room = makeRoom(['p1', 'p2', 'p3']);
    startRoundReady(room);
    room.currentRound!.players['p1'].numberCards = [1, 2, 3, 4, 5, 6];
    injectDeck(room, [{ kind: 'number', value: 0 }]);

    room.currentRound!.currentTurnIndex = room.currentRound!.turnOrder.indexOf('p1');
    playerHit(room, 'p1');

    // finalizeRound is called automatically inside
    expect(room.roundHistory.length).toBeGreaterThan(0);
  });
});

describe('Action cards', () => {
  it('freeze action transitions target to stayed', () => {
    const room = makeRoom(['p1', 'p2', 'p3']);
    startRoundReady(room);
    injectDeck(room, [{ kind: 'action', action: 'freeze' }]);

    room.currentRound!.currentTurnIndex = room.currentRound!.turnOrder.indexOf('p1');
    playerHit(room, 'p1');

    // pendingAction should be set (3 players so not auto-resolved)
    const pa = room.currentRound!.pendingAction;
    expect(pa).not.toBeNull();
    expect(pa!.action).toBe('freeze');
    expect(pa!.drawerId).toBe('p1');

    // Choose p2 as freeze target
    chooseActionTarget(room, 'p1', 'p2');
    expect(room.currentRound!.players['p2'].status).toBe('stayed');
    expect(room.currentRound!.pendingAction).toBeNull();
    // Turn must advance away from drawer (p1) after freeze resolves
    const turnPlayerId = room.currentRound!.turnOrder[room.currentRound!.currentTurnIndex];
    expect(turnPlayerId).not.toBe('p1');
  });

  it('secondChance gives target the token', () => {
    const room = makeRoom(['p1', 'p2', 'p3']);
    startRoundReady(room);
    injectDeck(room, [{ kind: 'action', action: 'secondChance' }]);

    room.currentRound!.currentTurnIndex = room.currentRound!.turnOrder.indexOf('p1');
    playerHit(room, 'p1');

    chooseActionTarget(room, 'p1', 'p2');
    expect(room.currentRound!.players['p2'].hasSecondChance).toBe(true);
  });

  it('flipThree sets 3 remaining draws on target', () => {
    const room = makeRoom(['p1', 'p2', 'p3']);
    startRoundReady(room);
    injectDeck(room, [{ kind: 'action', action: 'flipThree' }]);

    room.currentRound!.currentTurnIndex = room.currentRound!.turnOrder.indexOf('p1');
    playerHit(room, 'p1');

    chooseActionTarget(room, 'p1', 'p2');
    expect(room.currentRound!.players['p2'].flipThreeRemaining).toBe(3);
  });

  it('freeze auto-targets self when only active player', () => {
    const room = makeRoom(['p1', 'p2', 'p3']);
    startRoundReady(room);
    // Bust or stay all other players
    room.currentRound!.players['p2'].status = 'busted';
    room.currentRound!.players['p3'].status = 'stayed';
    injectDeck(room, [{ kind: 'action', action: 'freeze' }]);

    room.currentRound!.currentTurnIndex = room.currentRound!.turnOrder.indexOf('p1');
    playerHit(room, 'p1');

    // Freeze allows self-targeting → auto-resolves on p1 → p1 becomes stayed
    expect(room.currentRound!.pendingAction).toBeNull();
    expect(room.currentRound!.players['p1'].status).toBe('stayed');
  });

  it('secondChance is discarded when no valid target (cannot self-target)', () => {
    const room = makeRoom(['p1', 'p2', 'p3']);
    startRoundReady(room);
    room.currentRound!.players['p2'].status = 'busted';
    room.currentRound!.players['p3'].status = 'stayed';
    injectDeck(room, [{ kind: 'action', action: 'secondChance' }]);

    room.currentRound!.currentTurnIndex = room.currentRound!.turnOrder.indexOf('p1');
    playerHit(room, 'p1');

    // Second Chance cannot self-target → discarded with no effect
    expect(room.currentRound!.pendingAction).toBeNull();
    expect(room.currentRound!.players['p1'].hasSecondChance).toBe(false);
  });
});

describe('finalizeRound + computeWinners', () => {
  it('accumulates scores into player totalScore', () => {
    const room = makeRoom(['p1', 'p2', 'p3']);
    startRoundReady(room);
    room.currentRound!.players['p1'].status = 'stayed';
    room.currentRound!.players['p1'].numberCards = [3, 5];
    room.currentRound!.players['p2'].status = 'busted';
    room.currentRound!.players['p3'].status = 'stayed';
    room.currentRound!.players['p3'].numberCards = [2];
    room.currentRound!.roundEndReason = 'allDone';

    finalizeRound(room);
    expect(room.players['p1'].totalScore).toBe(8);
    expect(room.players['p2'].totalScore).toBe(0);
    expect(room.players['p3'].totalScore).toBe(2);
  });

  it('returns empty when no player reaches target', () => {
    const room = makeRoom(['p1', 'p2']);
    room.players['p1'].totalScore = 100;
    room.players['p2'].totalScore = 50;
    room.targetScore = 200;
    expect(computeWinners(room)).toEqual([]);
  });

  it('returns single winner when they uniquely reached target', () => {
    const room = makeRoom(['p1', 'p2']);
    room.players['p1'].totalScore = 210;
    room.players['p2'].totalScore = 150;
    room.targetScore = 200;
    expect(computeWinners(room)).toEqual(['p1']);
  });

  it('returns empty (tie → play again) when two players tied at top', () => {
    const room = makeRoom(['p1', 'p2']);
    room.players['p1'].totalScore = 210;
    room.players['p2'].totalScore = 210;
    room.targetScore = 200;
    expect(computeWinners(room)).toEqual([]);
  });
});

describe('Deck reshuffle', () => {
  it('reshuffles discard when deck runs out', () => {
    const room = makeRoom(['p1', 'p2', 'p3']);
    startRoundReady(room);

    // Empty the deck
    room.currentRound!.deck = [];
    // Populate discard with one card
    room.currentRound!.discard = [{ kind: 'number', value: 9 }];

    room.currentRound!.currentTurnIndex = room.currentRound!.turnOrder.indexOf('p1');
    // This should trigger reshuffle and draw successfully without throwing
    expect(() => playerHit(room, 'p1')).not.toThrow();
  });
});
