import { onUnmounted, ref, type Ref } from 'vue';
import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@shared/events';

export type KritzelagentSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

function normalizeNamespace(namespace?: string): string {
  if (!namespace) return '/g/kritzelagent';
  return namespace.startsWith('/') ? namespace : `/${namespace}`;
}

function resolveSocketUrl(apiBaseUrl: string | undefined, namespace: string): string {
  const base = apiBaseUrl?.trim();
  if (!base) return namespace;
  if (/^https?:\/\//i.test(base))
    return `${new URL(base, window.location.origin).origin}${namespace}`;
  if (base.startsWith('/')) return namespace;
  return `${base.replace(/\/+$/, '')}${namespace}`;
}

export function useSocket(opts?: {
  apiBaseUrl?: string;
  sessionId?: string;
  joinToken?: string;
  playerId?: string;
  wsNamespace?: string;
}): { socket: KritzelagentSocket; connected: Ref<boolean> } {
  const connected = ref(false);
  const namespace = normalizeNamespace(opts?.wsNamespace);
  const socket: KritzelagentSocket = io(resolveSocketUrl(opts?.apiBaseUrl, namespace), {
    auth: {
      sessionId: opts?.sessionId,
      joinToken: opts?.joinToken,
      playerId: opts?.playerId,
    },
    autoConnect: false,
    transports: ['websocket', 'polling'],
  });
  socket.on('connect', () => (connected.value = true));
  socket.on('disconnect', () => (connected.value = false));
  onUnmounted(() => socket.disconnect());
  return { socket, connected };
}
