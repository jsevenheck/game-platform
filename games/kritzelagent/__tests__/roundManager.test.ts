import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DRAWING_TURNS_PER_PLAYER } from '@shared/constants';
import { privateAssignmentFor, buildRoomView } from '../server/src/managers/broadcastManager';
import {
  currentDrawingPlayerId,
  nextRound,
  recheckAfterDisconnect,
  startGame,
  submitAgentGuess,
  submitStroke,
  submitVote,
} from '../server/src/managers/roundManager';
import {
  __resetRoomStoreForTests,
  attachPlayerToRoom,
  createRoom,
  findPlayer,
} from '../server/src/models/room';
import type { ServerRoom } from '../core/src/types';

beforeEach(() => {
  __resetRoomStoreForTests();
  vi.restoreAllMocks();
});

function setupRoom(playerCount = 5): { room: ServerRoom; playerIds: string[] } {
  const room = createRoom('Host', { matchKey: `match-${Math.random()}`, totalRounds: 2 });
  const playerIds = [room.hostPlayerId];
  for (let index = 1; index < playerCount; index += 1) {
    playerIds.push(attachPlayerToRoom(room, `Player ${index}`).playerId);
  }
  return { room, playerIds };
}

const stroke = [
  { x: 0.1, y: 0.1 },
  { x: 0.2, y: 0.2 },
];

function finishDrawing(room: ServerRoom): void {
  const totalTurns = room.drawingOrder.length * DRAWING_TURNS_PER_PLAYER;
  for (let turn = 0; turn < totalTurns; turn += 1) {
    const playerId = currentDrawingPlayerId(room);
    expect(playerId).not.toBeNull();
    submitStroke(room, playerId!, stroke);
  }
}

describe('round lifecycle', () => {
  it('starts with a private assignment and a deterministic two-stroke drawing phase', () => {
    const { room, playerIds } = setupRoom();
    startGame(room);

    expect(room.phase).toBe('drawing');
    expect(room.currentRound).toBe(1);
    expect(room.topic).not.toBeNull();
    expect(room.agentId).toBeOneOf(playerIds);
    expect(room.drawingOrder).toHaveLength(playerIds.length);

    const publicView = buildRoomView(room);
    expect(publicView.revealedAgentId).toBeNull();
    expect(publicView.revealedTopic).toBeNull();

    const agentAssignment = privateAssignmentFor(room, room.agentId!);
    const artistId = playerIds.find((playerId) => playerId !== room.agentId)!;
    const artistAssignment = privateAssignmentFor(room, artistId);
    expect(agentAssignment).toEqual({
      category: room.topic!.category,
      topic: null,
      isAgent: true,
    });
    expect(artistAssignment).toEqual({
      category: room.topic!.category,
      topic: room.topic!.topic,
      isAgent: false,
    });
  });

  it("accepts only the active player's valid stroke and enters voting after the quorum", () => {
    const { room } = setupRoom();
    startGame(room);
    const active = currentDrawingPlayerId(room)!;
    const other = room.drawingOrder.find((playerId) => playerId !== active)!;

    expect(() => submitStroke(room, other, stroke)).toThrow('It is not your drawing turn');
    expect(() => submitStroke(room, active, [{ x: 0, y: 0 }])).toThrow('Invalid stroke');

    finishDrawing(room);
    expect(room.phase).toBe('voting');
    expect(room.strokes).toHaveLength(room.players.length * DRAWING_TURNS_PER_PLAYER);
    expect(room.players.every((player) => player.strokesSubmitted === 2)).toBe(true);
  });

  it('moves to agentGuess only for a unique agent vote leader, then reveals artist points on a miss', () => {
    const { room } = setupRoom();
    startGame(room);
    finishDrawing(room);

    const agentId = room.agentId!;
    const artistId = room.players.find((player) => player.id !== agentId)!.id;
    for (const player of room.players) {
      submitVote(room, player.id, player.id === agentId ? artistId : agentId);
    }

    expect(room.phase).toBe('agentGuess');
    submitAgentGuess(room, agentId, 'definitiv falsch');
    expect(room.phase).toBe('reveal');
    expect(room.roundResult?.agentCaught).toBe(true);
    expect(room.roundResult?.agentGuessed).toBe(false);
    expect(room.scores.get(agentId)).toBe(0);
    expect(room.scores.get(artistId)).toBe(1);
    expect(buildRoomView(room).revealedTopic).toBe(room.topic!.topic);
  });

  it('does not resolve tied top votes as an agent catch', () => {
    const { room } = setupRoom(6);
    startGame(room);
    finishDrawing(room);

    const leftId = room.players[0]!.id;
    const rightId = room.players[1]!.id;
    let leftVotes = 0;
    let rightVotes = 0;
    for (const player of room.players) {
      let targetId: string;
      if (player.id === leftId) targetId = rightId;
      else if (player.id === rightId) targetId = leftId;
      else if (leftVotes <= rightVotes) targetId = leftId;
      else targetId = rightId;
      submitVote(room, player.id, targetId);
      if (targetId === leftId) leftVotes += 1;
      else rightVotes += 1;
    }

    expect(leftVotes).toBe(rightVotes);
    expect(room.phase).toBe('reveal');
    expect(room.roundResult?.agentCaught).toBe(false);
    expect(room.scores.get(room.agentId!)).toBe(2);
  });

  it('advances after reveal and finishes after the configured number of rounds', () => {
    const { room } = setupRoom();
    startGame(room);
    finishDrawing(room);
    const targetId =
      room.players[0]!.id === room.agentId ? room.players[1]!.id : room.players[0]!.id;
    for (const [index, player] of room.players.entries()) {
      const voteTarget =
        player.id === targetId ? room.players[(index + 1) % room.players.length]!.id : targetId;
      submitVote(room, player.id, voteTarget);
    }
    if (room.phase === 'agentGuess') submitAgentGuess(room, room.agentId!, room.topic!.topic);
    expect(room.phase).toBe('reveal');

    nextRound(room);
    expect(room.phase).toBe('drawing');
    expect(room.currentRound).toBe(2);
    expect(room.strokes).toHaveLength(0);
  });

  it('resolves voting when the last unsubmitted voter disconnects', () => {
    const { room } = setupRoom();
    startGame(room);
    finishDrawing(room);

    const missingVoter = room.players.at(-1)!;
    const targetId = room.players.find(
      (player) => player.id !== room.agentId && player.id !== missingVoter.id
    )!.id;
    const alternateTarget = room.players.find(
      (player) => player.id !== targetId && player.id !== missingVoter.id
    )!.id;
    for (const player of room.players.slice(0, -1)) {
      submitVote(room, player.id, player.id === targetId ? alternateTarget : targetId);
    }
    expect(room.phase).toBe('voting');

    missingVoter.connected = false;
    recheckAfterDisconnect(room);

    expect(room.phase).toBe('reveal');
    expect(room.roundResult).not.toBeNull();
  });

  it('resolves a caught agent as a miss when that agent disconnects before guessing', () => {
    const { room } = setupRoom();
    startGame(room);
    finishDrawing(room);

    const agentId = room.agentId!;
    const agent = findPlayer(room, agentId)!;
    const artistTarget = room.players.find((player) => player.id !== agentId)!.id;
    for (const player of room.players) {
      submitVote(room, player.id, player.id === agentId ? artistTarget : agentId);
    }
    expect(room.phase).toBe('agentGuess');

    agent.connected = false;
    recheckAfterDisconnect(room);

    expect(room.phase).toBe('reveal');
    expect(room.roundResult?.agentCaught).toBe(true);
    expect(room.roundResult?.agentGuessed).toBe(false);
  });
});

describe('room model smoke', () => {
  it('keeps disconnect state visible and can find players', () => {
    const { room, playerIds } = setupRoom();
    findPlayer(room, playerIds[1]!)!.connected = false;
    expect(findPlayer(room, playerIds[1]!)?.connected).toBe(false);
    expect(() => startGame(room)).toThrow('Need at least 5 connected players');
  });
});
