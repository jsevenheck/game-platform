<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, shallowRef } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { isTerminalResumeError, usePartyStore } from '../stores/party';
import { usePartySocket } from '../composables/usePartySocket';
import { usePartyRequests } from '../composables/usePartyRequests';
import { getClientGame } from '../games/index';
import LanguageSwitcher from '../components/LanguageSwitcher.vue';
import { localizeError } from '../i18n/serverError';
import { useModalDialog } from '../composables/useModalDialog';
import type { Component } from 'vue';

const props = defineProps<{ inviteCode: string; gameId: string }>();
const { t } = useI18n();
const router = useRouter();
const store = usePartyStore();
const socket = usePartySocket();
const { request, isActive } = usePartyRequests(socket);
const actionPending = ref(false);

const gameComponent = shallowRef<Component | null>(null);
const loadError = ref('');
const actionError = ref('');
const showLeaveConfirm = ref(false);
const leaveDialogRef = ref<HTMLElement | null>(null);
useModalDialog(leaveDialogRef, { onEscape: () => (showLeaveConfirm.value = false) });

// The matchKey drives which match instance is rendered.
// When it changes, Vue re-mounts the game adapter with the new match.
const matchKey = computed(() => store.party?.activeMatch?.matchKey ?? null);
const namespace = computed(() => store.party?.activeMatch?.namespace ?? `/g/${props.gameId}`);

// Platform callbacks passed down to the game adapter
async function onReplayGame(): Promise<void> {
  if (!store.playerId || actionPending.value) return;
  actionPending.value = true;
  actionError.value = '';
  const res = await request('replayGame', { playerId: store.playerId });
  if (!res) return;
  actionPending.value = false;
  if (!res.ok) actionError.value = res.error;
}

async function onReturnToLobby(): Promise<void> {
  if (!store.playerId || actionPending.value) return;
  actionPending.value = true;
  actionError.value = '';
  const res = await request('returnToLobby', { playerId: store.playerId });
  if (!res) return;
  actionPending.value = false;
  if (!res.ok) actionError.value = res.error;
}

function onLeaveGame(): void {
  router.push(`/party/${props.inviteCode}`);
}

function handlePartyUpdate(view: Parameters<typeof store.applyPartyUpdate>[0]) {
  store.applyPartyUpdate(view);

  // Server told us to return to lobby
  if (view.status === 'returning' || view.status === 'lobby') {
    if (store.playerId) {
      socket.emit('ackReturnedToLobby', { playerId: store.playerId });
    }
    router.push(`/party/${props.inviteCode}`);
  }
}

function handlePartyKicked(): void {
  store.clearSession();
  router.push('/');
}

async function loadGameComponent(retries = 2): Promise<void> {
  const game = getClientGame(props.gameId);
  if (!game) {
    loadError.value = t('gameView.unknownGame', { id: props.gameId });
    return;
  }

  let lastError: unknown;
  for (let i = 0; i <= retries; i++) {
    try {
      const mod = await game.loadClient();
      if (!isActive()) return;
      gameComponent.value = mod.default;
      loadError.value = '';
      return;
    } catch (e) {
      lastError = e;
      console.warn(`[GameView] load attempt ${i + 1} failed:`, e);
      if (i < retries) {
        await new Promise((r) => setTimeout(r, 500 * (i + 1)));
      }
    }
  }

  if (isActive()) loadError.value = t('gameView.loadFailed', { reason: String(lastError) });
}

// Initial reload and reconnect share one bounded, cancellable resume path.
async function resumePartyBinding(): Promise<boolean> {
  const session = store.loadSession();
  if (!session || session.inviteCode !== props.inviteCode) {
    await router.push('/');
    return false;
  }
  const res = await request('resumeParty', {
    inviteCode: session.inviteCode,
    playerId: session.playerId,
    resumeToken: session.resumeToken,
  });
  if (!res) return false;
  if (!res.ok) {
    if (isTerminalResumeError(res.error)) {
      store.endSession();
      await router.push('/');
    } else {
      loadError.value = localizeError(res.error);
    }
    return false;
  }
  store.setSession(session);
  handlePartyUpdate(res.partyView);
  loadError.value = '';
  if (store.party?.activeMatch && !gameComponent.value) await loadGameComponent();
  return true;
}

onMounted(async () => {
  socket.on('partyUpdate', handlePartyUpdate);
  socket.on('partyKicked', handlePartyKicked);

  const needsResume =
    !socket.connected ||
    !store.playerId ||
    !store.resumeToken ||
    store.party?.inviteCode !== props.inviteCode;
  const resumed = !needsResume || (await resumePartyBinding());
  if (!isActive()) return;
  socket.on('connect', resumePartyBinding);
  if (!resumed) return;

  if (!store.party?.activeMatch) {
    await router.push(`/party/${props.inviteCode}`);
    return;
  }
  if (!gameComponent.value) await loadGameComponent();
});

onBeforeUnmount(() => {
  socket.off('partyUpdate', handlePartyUpdate);
  socket.off('partyKicked', handlePartyKicked);
  socket.off('connect', resumePartyBinding);
});
</script>

<template>
  <div class="game-shell min-h-dvh">
    <!-- Platform controls are teleported to body and stacked above game overlays (ui-overlay, z 9999) so leaving/switching language stays possible in every state -->
    <Teleport to="body">
      <div class="game-controls game-controls-start">
        <button class="game-leave-btn" @click="showLeaveConfirm = true">
          <span class="game-leave-arrow">←</span> {{ t('gameView.leave') }}
        </button>
      </div>
      <div class="game-controls game-controls-end">
        <LanguageSwitcher />
      </div>
    </Teleport>

    <!-- Leave confirmation dialog -->
    <Transition name="fade">
      <div v-if="showLeaveConfirm" class="ui-overlay game-leave-overlay">
        <div
          ref="leaveDialogRef"
          class="ui-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="game-leave-title"
          aria-describedby="game-leave-desc"
        >
          <div class="game-dialog-icon" aria-hidden="true">🚪</div>
          <h2 id="game-leave-title" class="game-dialog-title">{{ t('gameView.leaveTitle') }}</h2>
          <p id="game-leave-desc" class="game-dialog-desc">{{ t('gameView.leaveDescription') }}</p>
          <div class="flex flex-col gap-3">
            <button class="ui-btn-danger" @click="onLeaveGame">
              {{ t('gameView.leaveConfirm') }}
            </button>
            <button class="ui-btn-secondary" data-autofocus @click="showLeaveConfirm = false">
              {{ t('gameView.stay') }}
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <div v-if="loadError" class="game-state-screen">
      <span class="game-state-icon">⚠️</span>
      <p class="game-state-title">{{ t('gameView.loadFailedTitle') }}</p>
      <p class="game-state-msg">{{ loadError }}</p>
    </div>

    <div v-else-if="!gameComponent || !matchKey" class="game-state-screen">
      <span class="game-state-icon game-state-spinner" aria-hidden="true" />
      <p class="game-state-title">{{ t('gameView.loading') }}</p>
      <p class="game-state-msg">{{ t('gameView.loadingHint') }}</p>
    </div>

    <!-- key on matchKey forces full re-mount when the match changes (replay) -->
    <component
      :is="gameComponent"
      v-else
      :key="matchKey"
      :match-key="matchKey"
      :player-id="store.playerId ?? ''"
      :player-name="store.playerName ?? ''"
      :namespace="namespace"
      :join-token="store.resumeToken ?? ''"
      :is-host="store.isHost"
      :on-replay-game="onReplayGame"
      :on-return-to-lobby="onReturnToLobby"
      :action-error="localizeError(actionError)"
    />
  </div>
</template>

<style scoped>
/* Stacking: game overlays (.ui-overlay) sit at z 9999. The teleported Leave/language
   controls stay above them, and the leave confirmation above both. */
.game-controls {
  position: fixed;
  top: 0.5rem;
  z-index: 10000;
}

.game-controls-start {
  left: 0.75rem;
}

.game-controls-end {
  right: 0.75rem;
}

.game-leave-overlay {
  z-index: 10001;
}

/* The fixed Leave button sits in the top-left corner; on phones game content
   is full-width and would start underneath it, so reserve its height. */
@media (max-width: 640px), (pointer: coarse) {
  .game-shell {
    padding-top: 3.5rem;
  }
}

.game-leave-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.4rem 0.875rem;
  background: rgba(12, 12, 20, 0.9);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-pill);
  color: var(--color-muted);
  font: inherit;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  transition: all 200ms ease;
}

@media (pointer: coarse) {
  .game-leave-btn {
    min-height: 2.75rem;
  }
}

.game-leave-btn:hover {
  color: var(--color-foreground);
  border-color: rgba(255, 255, 255, 0.15);
  background: rgba(20, 20, 32, 0.95);
}

.game-leave-arrow {
  font-size: 0.875rem;
  line-height: 1;
}

/* Dialog */
.game-dialog-icon {
  font-size: 2rem;
  margin-bottom: 0.75rem;
  line-height: 1;
}

.game-dialog-title {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--color-foreground);
  margin-bottom: 0.5rem;
  letter-spacing: -0.01em;
}

.game-dialog-desc {
  font-size: 0.875rem;
  color: var(--color-muted-foreground);
  margin-bottom: 1.75rem;
  line-height: 1.5;
}

/* Loading / error state */
.game-state-screen {
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 2rem;
}

.game-state-icon {
  font-size: 2.5rem;
  margin-bottom: 0.5rem;
  line-height: 1;
}

.game-state-spinner {
  display: inline-block;
  width: 2.75rem;
  height: 2.75rem;
  border: 3px solid rgba(249, 115, 22, 0.16);
  border-top-color: var(--color-accent);
  border-right-color: var(--color-accent-hover);
  border-radius: 50%;
  box-shadow: 0 0 24px rgba(249, 115, 22, 0.16);
  animation: spin 900ms linear infinite;
}

.game-state-title {
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--color-foreground);
}

.game-state-msg {
  font-size: 0.875rem;
  color: var(--color-muted-foreground);
  text-align: center;
  max-width: 320px;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
