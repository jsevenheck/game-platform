import { onScopeDispose } from 'vue';
import {
  PARTY_ACK_TIMEOUT_MS,
  type PartyClientToServerEvents,
  type PartySocket,
} from './usePartySocket';

type AckEvent =
  | 'createParty'
  | 'joinParty'
  | 'resumeParty'
  | 'selectGame'
  | 'launchGame'
  | 'replayGame'
  | 'returnToLobby'
  | 'setPartyPublic';
type Payload<E extends AckEvent> = Parameters<PartyClientToServerEvents[E]>[0];
type Response<E extends AckEvent> = Parameters<Parameters<PartyClientToServerEvents[E]>[1]>[0];
type Failure = { ok: false; error: string };

/** Bounded acknowledgements, without retries of non-idempotent mutations. */
export function usePartyRequests(socket: PartySocket) {
  let disposed = false;
  const cancellations = new Set<() => void>();
  onScopeDispose(() => {
    disposed = true;
    for (const cancel of cancellations) cancel();
    cancellations.clear();
  });

  function waitForConnection(): Promise<boolean> {
    if (disposed) return Promise.resolve(false);
    if (socket.connected) return Promise.resolve(true);
    return new Promise((resolve) => {
      const finish = (connected: boolean) => {
        clearTimeout(timer);
        socket.off('connect', connectedCallback);
        cancellations.delete(cancel);
        resolve(connected);
      };
      const connectedCallback = () => finish(true);
      const cancel = () => finish(false);
      const timer = setTimeout(cancel, PARTY_ACK_TIMEOUT_MS);
      cancellations.add(cancel);
      socket.once('connect', connectedCallback);
      socket.connect();
    });
  }

  async function request<E extends AckEvent>(
    event: E,
    payload: Payload<E>
  ): Promise<Response<E> | Failure | undefined> {
    const connected = await waitForConnection();
    if (disposed) return undefined;
    if (!connected) return { ok: false, error: 'Request timed out' };

    return new Promise((resolve) => {
      const cancel = () => resolve(undefined);
      cancellations.add(cancel);
      // Socket.IO's generic emit overload cannot correlate a union event with
      // its payload/ack. The public request signature preserves that pairing.
      const emit = socket.timeout(PARTY_ACK_TIMEOUT_MS).emit as unknown as (
        event: E,
        payload: Payload<E>,
        callback: (error: Error | null, response: Response<E>) => void
      ) => void;
      emit.call(socket, event, payload, (error, response) => {
        cancellations.delete(cancel);
        if (disposed) return resolve(undefined);
        resolve(error ? { ok: false, error: 'Request timed out' } : response);
      });
    });
  }

  return { request, isActive: () => !disposed };
}
