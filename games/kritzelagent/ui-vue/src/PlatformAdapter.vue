<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import GameApp from './App.vue';

interface Props {
  matchKey: string;
  playerId: string;
  playerName: string;
  namespace: string;
  joinToken?: string;
  isHost?: boolean;
  onReplayGame?: () => void;
  onReturnToLobby?: () => void;
  actionError?: string;
}
const props = withDefaults(defineProps<Props>(), {
  joinToken: '',
  isHost: false,
  onReplayGame: undefined,
  onReturnToLobby: undefined,
  actionError: '',
});
const gamePhase = ref('');
const dialog = ref<HTMLElement | null>(null);
const replayButton = ref<HTMLButtonElement | null>(null);
const gameEnded = computed(() => gamePhase.value === 'ended');
const showHostDialog = computed(() => gameEnded.value && props.isHost);
watch(showHostDialog, async (visible) => {
  if (!visible) return;
  await nextTick();
  replayButton.value?.focus();
});
function trapDialogFocus(event: KeyboardEvent) {
  if (event.key !== 'Tab' || !dialog.value) return;
  const controls = Array.from(
    dialog.value.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
    )
  );
  if (controls.length === 0) return;
  const first = controls[0]!;
  const last = controls.at(-1)!;
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}
function onPhaseChange(phase: string) {
  gamePhase.value = phase;
}
</script>

<template>
  <div class="platform-game-wrapper">
    <div class="platform-game-surface" :inert="showHostDialog">
      <GameApp
        :ws-namespace="namespace"
        :session-id="matchKey"
        :player-name="playerName"
        :player-id="playerId"
        :join-token="joinToken"
        :is-host="isHost"
        @phase-change="onPhaseChange"
      />
    </div>
    <section
      v-if="showHostDialog"
      ref="dialog"
      class="platform-overlay platform-overlay--modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="kritzelagent-postgame-title"
      @keydown="trapDialogFocus"
    >
      <h2 id="kritzelagent-postgame-title" class="text-xl font-semibold">Spiel beendet</h2>
      <p class="text-sm text-muted-foreground">Wie soll es für die Party weitergehen?</p>
      <button
        ref="replayButton"
        class="ui-btn-primary"
        type="button"
        data-testid="platform-replay"
        @click="onReplayGame?.()"
      >
        Nochmal spielen
      </button>
      <button
        class="ui-btn-secondary"
        type="button"
        data-testid="platform-return"
        @click="onReturnToLobby?.()"
      >
        Zurück zur Party
      </button>
      <p v-if="actionError" class="text-center text-sm text-danger" role="alert">
        {{ actionError }}
      </p>
    </section>
    <section v-else-if="gameEnded" class="platform-overlay" role="status">
      <p class="text-sm text-muted-foreground">Warte auf die Entscheidung des Hosts…</p>
    </section>
  </div>
</template>

<style scoped>
.platform-game-wrapper {
  position: relative;
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-height: 0;
}
.platform-game-surface {
  display: flex;
  flex: 1 1 auto;
  min-height: 0;
}
.platform-overlay {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  width: min(calc(100% - 1.5rem), 62rem);
  margin: 0 auto 1rem;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-lg, 0.75rem);
  background: var(--color-surface, #11111a);
  padding: 1.5rem;
  text-align: center;
}
.platform-overlay--modal {
  position: absolute;
  z-index: 10;
  inset: 1rem;
  max-height: min-content;
  margin: auto;
  box-shadow: 0 1.5rem 4rem rgba(0, 0, 0, 0.65);
}
</style>
