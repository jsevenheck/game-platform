import { defineStore } from 'pinia';
import type { RoomView, StoredSession } from '@shared/types';

const SESSION_KEY = 'herd-mentality.session';

export const useGameStore = defineStore('herd-mentality-game', {
  state: () => ({
    room: null as RoomView | null,
    sessionId: '',
    roomCode: '',
    playerId: '',
    playerName: '',
    resumeToken: '',
    myAnswer: null as string | null,
    errorMessage: '',
  }),
  getters: {
    self: (state) => state.room?.players.find((player) => player.id === state.playerId) ?? null,
    isHost(): boolean {
      return this.self?.isHost ?? false;
    },
    phase: (state) => state.room?.phase ?? 'lobby',
    canStart(): boolean {
      return (
        (this.room?.players.filter((player) => player.connected).length ?? 0) >= 4 &&
        this.phase === 'lobby'
      );
    },
    submittedCount: (state): number =>
      state.room?.players.filter((player) => player.hasSubmitted).length ?? 0,
    connectedCount: (state): number =>
      state.room?.players.filter((player) => player.connected).length ?? 0,
    myScore: (state): number =>
      state.room?.scores.find((score) => score.playerId === state.playerId)?.cows ?? 0,
  },
  actions: {
    setRoom(room: RoomView) {
      if (this.room?.currentRound !== room.currentRound || room.phase === 'lobby')
        this.myAnswer = null;
      this.room = room;
      this.roomCode = room.roomCode;
    },
    setMyAnswer(answer: string | null) {
      this.myAnswer = answer;
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
