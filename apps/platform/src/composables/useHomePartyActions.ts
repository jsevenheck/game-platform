import { ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { usePartyStore } from '../stores/party';
import { usePartySocket } from './usePartySocket';

const NAME_KEY = 'home.playerName';
const CODE_KEY = 'home.inviteCode';

function readStr(key: string): string {
  try {
    return sessionStorage.getItem(key) ?? '';
  } catch {
    return '';
  }
}

function writeStr(key: string, value: string): void {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    /* ignore storage errors */
  }
}

/**
 * Owns the home-page create/join/resume actions and their form state.
 *
 * Moved out of `HomeView.vue` so the view stays a thin composition shell.
 * `playerName` and `inviteCode` drafts persist in `sessionStorage` so they
 * survive tab switches and refreshes. `selectedGameId` is in-memory only.
 * Must NOT disconnect the shared party socket.
 */
export function useHomePartyActions() {
  const router = useRouter();
  const store = usePartyStore();
  const socket = usePartySocket();

  const playerName = ref(readStr(NAME_KEY));
  const inviteCode = ref(readStr(CODE_KEY));
  const selectedGameId = ref<string | null>(null);
  const error = ref('');
  const submitting = ref(false);
  const isResuming = ref(false);

  watch(playerName, (v) => writeStr(NAME_KEY, v));
  watch(inviteCode, (v) => writeStr(CODE_KEY, v));

  function clearError(): void {
    error.value = '';
  }

  function handleCreate(): void {
    const name = playerName.value.trim();
    if (!name || submitting.value) return;
    error.value = '';
    submitting.value = true;

    socket.emit('createParty', { playerName: name }, (res) => {
      if (!res.ok) {
        error.value = res.error;
        submitting.value = false;
        return;
      }
      store.setSession({
        playerId: res.playerId,
        playerName: name,
        inviteCode: res.partyView.inviteCode,
        resumeToken: res.resumeToken,
      });
      store.applyPartyUpdate(res.partyView);
      store.saveSession(res.partyView.inviteCode);

      const code = res.partyView.inviteCode;
      const gameId = selectedGameId.value;
      submitting.value = false;

      // Best-effort, non-blocking game preselect. The party is already created;
      // navigate regardless so it stays usable even if preselect fails.
      if (gameId) {
        socket.emit('selectGame', { playerId: res.playerId, gameId }, (sel) => {
          if (!sel.ok) {
            // HomeView is unmounting; the host can still select manually in PartyView.
            error.value = sel.error;
          }
        });
      }
      router.push(`/party/${code}`);
    });
  }

  function handleJoin(): void {
    const name = playerName.value.trim();
    const code = inviteCode.value.trim().toUpperCase();
    if (!name || !code || submitting.value) return;
    error.value = '';
    submitting.value = true;

    socket.emit('joinParty', { playerName: name, inviteCode: code }, (res) => {
      submitting.value = false;
      if (!res.ok) {
        error.value = res.error;
        return;
      }
      store.setSession({
        playerId: res.playerId,
        playerName: name,
        inviteCode: res.partyView.inviteCode,
        resumeToken: res.resumeToken,
      });
      store.applyPartyUpdate(res.partyView);
      store.saveSession(res.partyView.inviteCode);
      router.push(`/party/${res.partyView.inviteCode}`);
    });
  }

  function tryResume(): void {
    const session = store.loadSession();
    if (!session) return;
    isResuming.value = true;

    socket.emit(
      'resumeParty',
      {
        inviteCode: session.inviteCode,
        playerId: session.playerId,
        resumeToken: session.resumeToken,
      },
      (res) => {
        isResuming.value = false;
        if (!res.ok) {
          store.clearSession();
          return;
        }
        store.setSession({
          playerId: session.playerId,
          playerName: session.playerName,
          inviteCode: session.inviteCode,
          resumeToken: session.resumeToken,
        });
        store.applyPartyUpdate(res.partyView);

        if (res.partyView.activeMatch) {
          router.push(`/party/${session.inviteCode}/game/${res.partyView.activeMatch.gameId}`);
        } else {
          router.push(`/party/${session.inviteCode}`);
        }
      }
    );
  }

  return {
    playerName,
    inviteCode,
    selectedGameId,
    error,
    submitting,
    isResuming,
    handleCreate,
    handleJoin,
    tryResume,
    clearError,
  };
}
