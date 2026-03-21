import { io, type Socket } from 'socket.io-client';
import type { PartyView } from '../stores/party';

interface PartyClientToServerEvents {
  createParty: (
    data: { playerName: string },
    cb: (
      res: { ok: true; partyView: PartyView; playerId: string } | { ok: false; error: string }
    ) => void
  ) => void;
  joinParty: (
    data: { inviteCode: string; playerName: string },
    cb: (
      res: { ok: true; partyView: PartyView; playerId: string } | { ok: false; error: string }
    ) => void
  ) => void;
  resumeParty: (
    data: { inviteCode: string; playerId: string },
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
  partyError: (message: string) => void;
}

export type PartySocket = Socket<PartyServerToClientEvents, PartyClientToServerEvents>;

let socket: PartySocket | null = null;

export function usePartySocket(apiBaseUrl?: string): PartySocket {
  if (!socket) {
    const base = apiBaseUrl ?? '';
    socket = io(`${base}/party`, {
      autoConnect: false,
    }) as PartySocket;
  }
  return socket;
}

export function disconnectPartySocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
