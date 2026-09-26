import { ref } from 'vue';
import { io, type Socket } from 'socket.io-client';
import type { PartyView } from '../stores/party';
import type { JoinablePartyView } from '../stores/publicLobbies';

export type JoinableListResponse =
  { ok: true; parties: JoinablePartyView[] } | { ok: false; error: string };

export type SetPartyPublicResponse = { ok: true; isPublic: boolean } | { ok: false; error: string };

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
    data: { playerId: string; locale?: string },
    cb: (res: { ok: true } | { ok: false; error: string }) => void
  ) => void;
  replayGame: (
    data: { playerId: string; locale?: string },
    cb: (res: { ok: true } | { ok: false; error: string }) => void
  ) => void;
  returnToLobby: (
    data: { playerId: string },
    cb: (res: { ok: true } | { ok: false; error: string }) => void
  ) => void;
  ackReturnedToLobby: (data: { playerId: string }) => void;
  listJoinableParties: (cb: (res: JoinableListResponse) => void) => void;
  subscribeJoinableParties: () => void;
  unsubscribeJoinableParties: () => void;
  setPartyPublic: (
    data: { playerId: string; isPublic: boolean },
    cb: (res: SetPartyPublicResponse) => void
  ) => void;
}

interface PartyServerToClientEvents {
  partyUpdate: (partyView: PartyView) => void;
  partyKicked: (data: { reason: string }) => void;
  joinablePartiesUpdate: (parties: JoinablePartyView[]) => void;
}

export type PartySocket = Socket<PartyServerToClientEvents, PartyClientToServerEvents>;

let socket: PartySocket | null = null;

/**
 * True while the party socket has lost (or cannot establish) its connection
 * and Socket.IO is retrying. Drives the app-wide connection banner so players
 * are never left looking at a silently frozen screen.
 */
export const partyConnectionLost = ref(false);

/** How long party actions wait for the server before giving up. */
export const PARTY_ACK_TIMEOUT_MS = 10_000;

export function usePartySocket(apiBaseUrl?: string): PartySocket {
  if (!socket) {
    const base = apiBaseUrl ?? '';
    socket = io(`${base}/party`, {
      autoConnect: false,
    }) as PartySocket;
    socket.on('connect', () => {
      partyConnectionLost.value = false;
    });
    socket.on('disconnect', (reason) => {
      partyConnectionLost.value = reason !== 'io client disconnect';
    });
    socket.on('connect_error', () => {
      partyConnectionLost.value = true;
    });
  }
  return socket;
}

export function disconnectPartySocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  partyConnectionLost.value = false;
}
