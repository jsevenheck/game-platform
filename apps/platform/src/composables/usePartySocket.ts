import { io, type Socket } from 'socket.io-client';
import type { PartyView } from '../stores/party';
import { usePartyStore } from '../stores/party';

interface PartyClientToServerEvents {
  createParty: (
    data: { playerName: string },
    cb: (
      res:
        | { ok: true; partyView: PartyView; playerId: string; resumeToken: string }
        | { ok: false; error: string }
    ) => void
  ) => void;
  joinParty: (
    data: { inviteCode: string; playerName: string },
    cb: (
      res:
        | { ok: true; partyView: PartyView; playerId: string; resumeToken: string }
        | { ok: false; error: string }
    ) => void
  ) => void;
  resumeParty: (
    data: { inviteCode: string; playerId: string; resumeToken: string },
    cb: (res: { ok: true; partyView: PartyView } | { ok: false; error: string }) => void
  ) => void;
  leaveParty: (data: { playerId: string }) => void;
  selectGame: (
    data: { playerId: string; gameId: string },
    cb: (res: { ok: true } | { ok: false; error: string }) => void
  ) => void;
  launchGame: (
    data: { playerId: string },
    cb: (res: { ok: true } | { ok: false; error: string }) => void
  ) => void;
  replayGame: (
    data: { playerId: string },
    cb: (res: { ok: true } | { ok: false; error: string }) => void
  ) => void;
  returnToLobby: (
    data: { playerId: string },
    cb: (res: { ok: true } | { ok: false; error: string }) => void
  ) => void;
  ackReturnedToLobby: (data: { playerId: string }) => void;
}

interface PartyServerToClientEvents {
  partyUpdate: (partyView: PartyView) => void;
}

export type PartySocket = Socket<PartyServerToClientEvents, PartyClientToServerEvents>;

let socket: PartySocket | null = null;

export function usePartySocket(apiBaseUrl?: string): PartySocket {
  if (!socket) {
    const base = apiBaseUrl ?? '';
    socket = io(`${base}/party`, {
      autoConnect: false,
    }) as PartySocket;

    const store = usePartyStore();
    socket.on('connect', () => {
      store.connectionLost = false;
    });
    socket.on('disconnect', () => {
      store.connectionLost = true;
    });
    socket.on('connect_error', () => {
      store.connectionLost = true;
    });
  }
  return socket;
}

export function disconnectPartySocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
