import type { Room } from '../core/src/types';
import {
  transitionToEnded,
  transitionToLobby,
  transitionToPlaying,
  validateTeamSetup,
} from '../server/src/managers/phaseManager';

function makeRoom(): Room {
  return {
    code: 'TEST',
    hostId: 'p1',
    phase: 'lobby',
    players: {},
    board: [],
    teams: [],
    currentTurnTeam: null,
    turnPhase: null,
    currentSignal: null,
    turnOrder: ['red', 'blue'],
    log: [],
    winnerTeam: null,
    winningTeams: [],
    teamCount: 2,
    assassinPenaltyMode: 'instant-loss',
    focusedCards: [],
    nextStartingTeamIndex: 0,
  };
}

describe('phaseManager', () => {
  test('transitionToPlaying sets phase to playing and generates board', () => {
    const room = makeRoom();
    transitionToPlaying(room);
    expect(room.phase).toBe('playing');
    expect(room.board).toHaveLength(25);
    expect(room.teams).toHaveLength(2);
    expect(room.currentTurnTeam).toBe('red');
    expect(room.turnPhase).toBe('giving-signal');
    expect(room.focusedCards).toHaveLength(0);
    expect(room.nextStartingTeamIndex).toBe(1);
  });

  test('transitionToPlaying rotates the starting team between games', () => {
    const room = makeRoom();
    room.nextStartingTeamIndex = 1;
    transitionToPlaying(room);
    expect(room.currentTurnTeam).toBe('blue');
    expect(room.turnOrder).toEqual(['blue', 'red']);
    expect(room.nextStartingTeamIndex).toBe(0);
  });

  test('transitionToEnded sets phase to ended with winners', () => {
    const room = makeRoom();
    transitionToPlaying(room);
    room.focusedCards = [{ cardIndex: 3, playerId: 'p2' }];
    transitionToEnded(room, ['red', 'blue']);
    expect(room.phase).toBe('ended');
    expect(room.winnerTeam).toBe('red');
    expect(room.winningTeams).toEqual(['red', 'blue']);
    expect(room.focusedCards).toHaveLength(0);
  });

  test('transitionToLobby resets game state', () => {
    const room = makeRoom();
    transitionToPlaying(room);
    room.focusedCards = [{ cardIndex: 5, playerId: 'p3' }];
    transitionToLobby(room);
    expect(room.phase).toBe('lobby');
    expect(room.board).toHaveLength(0);
    expect(room.teams).toHaveLength(0);
    expect(room.winningTeams).toHaveLength(0);
    expect(room.focusedCards).toHaveLength(0);
    expect(room.turnOrder).toEqual(['red', 'blue']);
  });

  test('validateTeamSetup returns error when players are unassigned', () => {
    const room = makeRoom();
    room.players = {
      p1: {
        id: 'p1',
        name: 'Alice',
        resumeToken: 'x',
        score: 0,
        connected: true,
        isHost: true,
        socketId: null,
        team: null,
        role: null,
      },
    };
    const result = validateTeamSetup(room);
    expect(result.valid).toBe(false);
  });

  test('validateTeamSetup passes with valid setup', () => {
    const room = makeRoom();
    room.players = {
      p1: {
        id: 'p1',
        name: 'Alice',
        resumeToken: 'x',
        score: 0,
        connected: true,
        isHost: true,
        socketId: null,
        team: 'red',
        role: 'director',
      },
      p2: {
        id: 'p2',
        name: 'Bob',
        resumeToken: 'y',
        score: 0,
        connected: true,
        isHost: false,
        socketId: null,
        team: 'red',
        role: 'agent',
      },
      p3: {
        id: 'p3',
        name: 'Carol',
        resumeToken: 'z',
        score: 0,
        connected: true,
        isHost: false,
        socketId: null,
        team: 'blue',
        role: 'director',
      },
      p4: {
        id: 'p4',
        name: 'Dave',
        resumeToken: 'w',
        score: 0,
        connected: true,
        isHost: false,
        socketId: null,
        team: 'blue',
        role: 'agent',
      },
    };
    const result = validateTeamSetup(room);
    expect(result.valid).toBe(true);
  });
});
