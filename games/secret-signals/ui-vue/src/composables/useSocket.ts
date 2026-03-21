import { ref, onUnmounted } from 'vue';
import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@shared/events';

const GAME_ID = 'secret-signals';

export type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export function useSocket(opts?: {
  apiBaseUrl?: string;
  sessionId?: string;
  playerId?: string;
  wsNamespace?: string;
}): {
  socket: GameSocket;
  connected: ReturnType<typeof ref<boolean>>;
} {
  const connected = ref(false);

  const url = opts?.apiBaseUrl || window.location.origin;
  const namespace = opts?.wsNamespace ?? `/g/${GAME_ID}`;

  const socket: GameSocket = io(`${url}${namespace}`, {
    auth: {
      sessionId: opts?.sessionId,
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
