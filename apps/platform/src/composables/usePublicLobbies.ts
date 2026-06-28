import { onMounted, onBeforeUnmount } from 'vue';
import { usePartySocket } from './usePartySocket';
import { usePublicLobbiesStore, type JoinablePartyView } from '../stores/publicLobbies';

/**
 * Owns the public-lobby feed subscription on the shared party socket.
 *
 * Must NOT disconnect the shared party socket — it only (un)subscribes to the
 * server-side watcher room. On mount it subscribes and the server immediately
 * pushes an initial snapshot via `joinablePartiesUpdate`. On reconnect it
 * re-subscribes. A manual `refresh()` is available for recovery and is
 * rate-limited server-side; rate-limit failures are non-destructive (existing
 * rooms are kept and a small error is surfaced).
 */
export function usePublicLobbies() {
  const socket = usePartySocket();
  const store = usePublicLobbiesStore();

  function handleUpdate(parties: JoinablePartyView[]): void {
    store.applyUpdate(parties);
  }

  function subscribe(): void {
    socket.emit('subscribeJoinableParties');
  }

  function refresh(): void {
    socket.emit('listJoinableParties', (res) => {
      if (res.ok) {
        store.applyUpdate(res.parties);
      } else if (res.error === 'rate_limited') {
        // Keep the last good list; surface a non-destructive error.
        store.setError('Too many refreshes. Try again in a moment.');
      } else {
        store.setError(res.error || 'Could not load live rooms.');
      }
    });
  }

  onMounted(() => {
    socket.on('joinablePartiesUpdate', handleUpdate);
    socket.on('connect', subscribe);

    store.setLoading();
    if (!socket.connected) {
      socket.connect();
    } else {
      subscribe();
    }
  });

  onBeforeUnmount(() => {
    socket.off('joinablePartiesUpdate', handleUpdate);
    socket.off('connect', subscribe);
    if (socket.connected) {
      socket.emit('unsubscribeJoinableParties');
    }
  });

  return {
    store,
    refresh,
  };
}
