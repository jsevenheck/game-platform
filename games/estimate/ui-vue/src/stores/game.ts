import { defineStore } from 'pinia';
import type { RoomView, StoredSession } from '@shared/types';

const SESSION_KEY = 'estimate.session';

export const useGameStore = defineStore('estimate-game', {
  state: () => ({
    room: null as RoomView | null,
    sessionId: '',
    roomCode: '',
    playerId: '',
    playerName: '',
    resumeToken: '',
    myGuess: null as number | null,
    errorMessage: '' as string,
  }),
  getters: {
    self: (state) => state.room?.players.find((p) => p.id === state.playerId) ?? null,
    isHost(): boolean {
      return this.self?.isHost ?? false;
    },
    phase: (state) => state.room?.phase ?? 'lobby',
    canStart(): boolean {
      // Mirror server MIN_PLAYERS (2). The server enforces the truth.
      return (this.room?.players.length ?? 0) >= 2 && this.phase === 'lobby';
    },
    myScore(): number {
      const id = this.playerId;
      return this.room?.scores.find((s) => s.playerId === id)?.points ?? 0;
    },
    submittedCount(): number {
      return this.room?.players.filter((p) => p.hasSubmitted).length ?? 0;
    },
    totalPlayers(): number {
      return this.room?.players.length ?? 0;
    },
  },
  actions: {
    setRoom(room: RoomView) {
      this.room = room;
      this.roomCode = room.roomCode;
    },
    setMyGuess(guess: number | null) {
      this.myGuess = guess;
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
