import { ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { isTerminalResumeError, usePartyStore } from '../stores/party';
import { usePartySocket } from './usePartySocket';
import { usePartyRequests } from './usePartyRequests';

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
    /* Draft persistence is best-effort. */
  }
}

/** Home form state and bounded create/join/resume requests. */
export function useHomePartyActions() {
  const router = useRouter();
  const store = usePartyStore();
  const { request, isActive } = usePartyRequests(usePartySocket());
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

  async function handleCreate(): Promise<void> {
    const name = playerName.value.trim();
    if (!name || submitting.value) return;
    error.value = '';
    submitting.value = true;
    const res = await request('createParty', { playerName: name });
    if (!res) return;
    if (!res.ok) {
      submitting.value = false;
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

    // Optional selection never prevents entering the successfully created
    // party, even if its acknowledgement is lost. Do not retry creation.
    if (selectedGameId.value) {
      await request('selectGame', { playerId: res.playerId, gameId: selectedGameId.value });
    }
    if (!isActive()) return;
    submitting.value = false;
    await router.push(`/party/${res.partyView.inviteCode}`);
  }

  async function handleJoin(): Promise<void> {
    const name = playerName.value.trim();
    const code = inviteCode.value.trim().toUpperCase();
    if (!name || !code || submitting.value) return;
    error.value = '';
    submitting.value = true;
    const res = await request('joinParty', { playerName: name, inviteCode: code });
    if (!res) return;
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
    await router.push(`/party/${res.partyView.inviteCode}`);
  }

  async function tryResume(): Promise<void> {
    const session = store.loadSession();
    if (!session || isResuming.value) return;
    isResuming.value = true;
    const res = await request('resumeParty', {
      inviteCode: session.inviteCode,
      playerId: session.playerId,
      resumeToken: session.resumeToken,
    });
    if (!res) return;
    isResuming.value = false;
    if (!res.ok) {
      if (isTerminalResumeError(res.error)) store.endSession();
      else error.value = res.error;
      return;
    }
    store.setSession(session);
    store.applyPartyUpdate(res.partyView);
    await router.push(
      res.partyView.activeMatch
        ? `/party/${session.inviteCode}/game/${res.partyView.activeMatch.gameId}`
        : `/party/${session.inviteCode}`
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
