import { defineStore } from 'pinia';
import type { RoomView, StoredSession } from '@shared/types';

const SESSION_KEY = 'scout.session';

export const useGameStore = defineStore('scout-game', {
  state: () => ({
    room: null as RoomView | null,
    roomCode: '',
    playerId: '',
    playerName: '',
    resumeToken: '',
  }),
  getters: {
    self: (state) => state.room?.players.find((p) => p.id === state.playerId) ?? null,
    isHost(): boolean {
      return this.self?.isHost ?? false;
    },
    phase: (state) => state.room?.phase ?? 'lobby',
    setupComplete: (state) => state.room?.setupComplete ?? false,
    myRow(): import('@shared/deck').ScoutCard[] {
      return this.self?.row ?? [];
    },
    currentTurnPlayerId: (state) => state.room?.trick?.currentTurnPlayerId ?? null,
    isMyTurn(): boolean {
      return this.currentTurnPlayerId === this.playerId;
    },
  },
  actions: {
    setRoom(room: RoomView) {
      this.room = room;
      this.roomCode = room.code;
    },
    saveSession() {
      const session: StoredSession = {
        playerId: this.playerId,
        roomCode: this.roomCode,
        name: this.playerName,
        resumeToken: this.resumeToken,
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
