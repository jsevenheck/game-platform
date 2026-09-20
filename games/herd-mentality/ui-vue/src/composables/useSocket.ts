import { onUnmounted, ref, type Ref } from 'vue';
import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@shared/events';

export type HerdMentalitySocket = Socket<ServerToClientEvents, ClientToServerEvents>;

function normalizeNamespace(namespace?: string): string {
  if (!namespace) return '/g/herd-mentality';
  return namespace.startsWith('/') ? namespace : `/${namespace}`;
}

function resolveSocketUrl(apiBaseUrl: string | undefined, namespace: string): string {
  const baseUrl = apiBaseUrl?.trim();
  if (!baseUrl) return namespace;
  if (/^https?:\/\//i.test(baseUrl)) {
    const origin = new URL(baseUrl, window.location.origin).origin;
    return `${origin}${namespace}`;
  }
  if (baseUrl.startsWith('/')) return namespace;
  return `${baseUrl.replace(/\/+$/, '')}${namespace}`;
}

export function useSocket(opts?: {
  apiBaseUrl?: string;
  sessionId?: string;
  joinToken?: string;
  playerId?: string;
  wsNamespace?: string;
}): { socket: HerdMentalitySocket; connected: Ref<boolean> } {
  const connected = ref(false);
  const namespace = normalizeNamespace(opts?.wsNamespace);
  const url = resolveSocketUrl(opts?.apiBaseUrl, namespace);

  const socket: HerdMentalitySocket = io(url, {
    auth: {
      sessionId: opts?.sessionId,
      joinToken: opts?.joinToken,
      playerId: opts?.playerId,
    },
    autoConnect: false,
    transports: ['websocket', 'polling'],
  });

  socket.on('connect', () => {
    connected.value = true;
  });
  socket.on('disconnect', () => {
    connected.value = false;
  });

  onUnmounted(() => {
    socket.disconnect();
  });

  return { socket, connected };
}
