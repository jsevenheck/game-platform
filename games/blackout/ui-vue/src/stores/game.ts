import { defineStore } from 'pinia';
import type { RoomView, StoredSession } from '@shared/types';

const SESSION_KEY = 'blackout.session';

export const useGameStore = defineStore('blackout-game', {
  state: () => ({
    room: null as RoomView | null,
    roomCode: '',
    playerId: '',
    playerName: '',
    resumeToken: '',
  }),
  getters: {
    self: (state) => state.room?.players.find((p) => p.id === state.playerId),
    isHost(): boolean {
      return this.self?.isHost ?? false;
    },
    isOwner: (state) => state.room?.ownerId === state.playerId,
    phase: (state) => state.room?.phase ?? 'lobby',
    isReader: (state) => state.room?.players.find((p) => p.id === state.playerId)?.isHost ?? false,
    currentRound: (state) => state.room?.currentRound,
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
