import { defineStore } from 'pinia';
import { MIN_PLAYERS } from '@shared/constants';
import type { PrivateAssignment, RoomView, StoredSession } from '@shared/types';

const SESSION_KEY = 'kritzelagent.session';

export const useGameStore = defineStore('kritzelagent-game', {
  state: () => ({
    room: null as RoomView | null,
    assignment: null as PrivateAssignment | null,
    sessionId: '',
    roomCode: '',
    playerId: '',
    playerName: '',
    resumeToken: '',
    errorMessage: '',
  }),
  getters: {
    self: (state) => state.room?.players.find((player) => player.id === state.playerId) ?? null,
    isHost(): boolean {
      return this.self?.isHost ?? false;
    },
    phase: (state) => state.room?.phase ?? 'lobby',
    connectedPlayers: (state) => state.room?.players.filter((player) => player.connected) ?? [],
    canStart(): boolean {
      return this.connectedPlayers.length >= MIN_PLAYERS && this.phase === 'lobby';
    },
    canDraw(): boolean {
      return this.phase === 'drawing' && this.room?.activePlayerId === this.playerId;
    },
    hasVoted(): boolean {
      return this.self?.hasVoted ?? false;
    },
    myScore(): number {
      return this.room?.scores.find((score) => score.playerId === this.playerId)?.points ?? 0;
    },
  },
  actions: {
    setRoom(room: RoomView) {
      if (this.room?.currentRound !== room.currentRound || room.phase === 'lobby') {
        this.assignment = room.phase === 'lobby' ? null : this.assignment;
      }
      this.room = room;
      this.roomCode = room.roomCode;
    },
    setAssignment(assignment: PrivateAssignment) {
      this.assignment = assignment;
    },
    setError(message: string) {
      this.errorMessage = message;
    },
    clearError() {
      this.errorMessage = '';
    },
    saveSession() {
      const session: StoredSession = {
        playerId: this.playerId,
        roomCode: this.roomCode,
        name: this.playerName,
        resumeToken: this.resumeToken,
        sessionId: this.sessionId,
      };
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    },
    loadSession(): StoredSession | null {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      try {
        return JSON.parse(raw) as StoredSession;
      } catch {
        return null;
      }
    },
    clearSession() {
      localStorage.removeItem(SESSION_KEY);
      this.$reset();
    },
  },
});
