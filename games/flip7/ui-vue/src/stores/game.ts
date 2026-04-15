import { defineStore } from 'pinia';
import type { RoomView, StoredSession } from '@shared/types';

export type DrawnCardInfo =
  | { kind: 'number'; value: number }
  | { kind: 'modifierAdd'; bonus: number }
  | { kind: 'modifierX2' }
  | { kind: 'action'; action: 'freeze' | 'flipThree' | 'secondChance' };

export interface ActionAnnouncement {
  drawerName: string;
  action: 'freeze' | 'flipThree' | 'secondChance';
  targetName: string;
  isSelf: boolean; // drawer === target
}

let _drawnCardTimer: ReturnType<typeof setTimeout> | null = null;
let _announcementTimer: ReturnType<typeof setTimeout> | null = null;

const SESSION_KEY = 'flip7.session';

export const useGameStore = defineStore('flip7-game', {
  state: () => ({
    room: null as RoomView | null,
    roomCode: '',
    playerId: '',
    playerName: '',
    resumeToken: '',
    drawnCard: null as DrawnCardInfo | null,
    actionAnnouncement: null as ActionAnnouncement | null,
  }),
  getters: {
    self: (state) => state.room?.players.find((p) => p.id === state.playerId),
    isHost(): boolean {
      return this.self?.isHost ?? false;
    },
    isOwner: (state) => state.room?.ownerId === state.playerId,
    phase: (state) => state.room?.phase ?? 'lobby',
    currentRound: (state) => state.room?.currentRound ?? null,
    myRoundPlayer(): import('@shared/types').RoundPlayerView | null {
      const round = this.room?.currentRound;
      if (!round || !this.playerId) return null;
      return round.players.find((rp) => rp.playerId === this.playerId) ?? null;
    },
    isMyTurn(): boolean {
      const round = this.room?.currentRound;
      if (!round || !this.playerId) return false;
      return round.currentTurnPlayerId === this.playerId;
    },
    hasPendingActionToResolve(): boolean {
      const round = this.room?.currentRound;
      if (!round || !this.playerId) return false;
      return round.pendingAction?.drawerId === this.playerId;
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
    setDrawnCard(card: DrawnCardInfo) {
      if (_drawnCardTimer) clearTimeout(_drawnCardTimer);
      this.drawnCard = card;
      _drawnCardTimer = setTimeout(() => {
        this.drawnCard = null;
        _drawnCardTimer = null;
      }, 1700);
    },
    setActionAnnouncement(ann: ActionAnnouncement) {
      if (_announcementTimer) clearTimeout(_announcementTimer);
      this.actionAnnouncement = ann;
      _announcementTimer = setTimeout(() => {
        this.actionAnnouncement = null;
        _announcementTimer = null;
      }, 3200);
    },
    clearSession() {
      // Cancel any in-flight toast timers so they don't fire on the reset store.
      if (_drawnCardTimer) {
        clearTimeout(_drawnCardTimer);
        _drawnCardTimer = null;
      }
      if (_announcementTimer) {
        clearTimeout(_announcementTimer);
        _announcementTimer = null;
      }
      localStorage.removeItem(SESSION_KEY);
      this.$reset();
    },
  },
});
