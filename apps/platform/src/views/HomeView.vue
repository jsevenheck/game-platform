<script setup lang="ts">
import { computed, nextTick, onMounted, onBeforeUnmount, ref, watch } from 'vue';
import { usePartyStore } from '../stores/party';
import { usePartySocket } from '../composables/usePartySocket';
import { useHomeTabs, HOME_TABS } from '../composables/useHomeTabs';
import { useHomePartyActions } from '../composables/useHomePartyActions';
import { getClientGame } from '../games';
import HomeTabBar from '../components/home/HomeTabBar.vue';
import BrowseTabPanel from '../components/home/BrowseTabPanel.vue';
import HostTabPanel from '../components/home/HostTabPanel.vue';
import JoinTabPanel from '../components/home/JoinTabPanel.vue';

const store = usePartyStore();
const socket = usePartySocket();
const { activeTab, setTab } = useHomeTabs();
const actions = useHomePartyActions();

const CTA_KEY = 'home.ctaDismissed';
const ctaDismissed = ref(readCtaDismissed());

function readCtaDismissed(): boolean {
  try {
    return sessionStorage.getItem(CTA_KEY) === '1';
  } catch {
    return false;
  }
}

watch(ctaDismissed, (v) => {
  try {
    if (v) sessionStorage.setItem(CTA_KEY, '1');
    else sessionStorage.removeItem(CTA_KEY);
  } catch {
    /* ignore */
  }
});

const selectedGameName = computed(() =>
  actions.selectedGameId.value
    ? (getClientGame(actions.selectedGameId.value)?.definition.name ?? null)
    : null
);

function handleSelectGame(gameId: string): void {
  actions.selectedGameId.value = gameId;
  setTab('host');
}

function handleClearSelectedGame(): void {
  actions.selectedGameId.value = null;
}

async function handleJoinRoom(payload: { inviteCode: string }): Promise<void> {
  actions.inviteCode.value = payload.inviteCode;
  actions.clearError();
  setTab('join');
  await nextTick();
  const selector = actions.playerName.value.trim() ? '#code' : '#name';
  document.querySelector<HTMLInputElement>(selector)?.focus();
}

onMounted(() => {
  socket.on('partyUpdate', store.applyPartyUpdate);
  socket.on('connect', actions.tryResume);

  if (socket.connected) {
    actions.tryResume();
  } else {
    socket.connect();
  }
});

onBeforeUnmount(() => {
  socket.off('partyUpdate', store.applyPartyUpdate);
  socket.off('connect', actions.tryResume);
});
</script>

<template>
  <div class="home-root">
    <div class="home-card" :class="activeTab === 'browse' ? 'home-card-wide' : 'home-card-compact'">
      <!-- Top accent line -->
      <div class="home-top-line" />

      <!-- Hero -->
      <div class="home-hero">
        <div class="home-logo-wrap">
          <span class="home-logo-icon">⚡</span>
        </div>
        <h1 class="home-title">Game Platform</h1>
        <p class="home-sub">Browse games, host a party, or join your friends</p>
      </div>

      <!-- Tab bar -->
      <HomeTabBar :model-value="activeTab" :tabs="HOME_TABS" @update:model-value="setTab" />

      <!-- Panels -->
      <Transition name="fade" mode="out-in">
        <div
          v-if="activeTab === 'browse'"
          id="home-panel-browse"
          key="browse"
          role="tabpanel"
          aria-labelledby="home-tab-browse"
          data-testid="home-panel-browse"
        >
          <BrowseTabPanel
            :cta-dismissed="ctaDismissed"
            @select-game="handleSelectGame"
            @join-room="handleJoinRoom"
            @host-requested="setTab('host')"
            @dismiss-cta="ctaDismissed = true"
          />
        </div>

        <div
          v-else-if="activeTab === 'host'"
          id="home-panel-host"
          key="host"
          role="tabpanel"
          aria-labelledby="home-tab-host"
          data-testid="home-panel-host"
        >
          <HostTabPanel
            :player-name="actions.playerName.value"
            :error="actions.error.value"
            :submitting="actions.submitting.value"
            :selected-game-name="selectedGameName"
            @update:player-name="actions.playerName.value = $event"
            @submit="actions.handleCreate()"
            @clear-selected-game="handleClearSelectedGame"
          />
        </div>

        <div
          v-else
          id="home-panel-join"
          key="join"
          role="tabpanel"
          aria-labelledby="home-tab-join"
          data-testid="home-panel-join"
        >
          <JoinTabPanel
            :player-name="actions.playerName.value"
            :invite-code="actions.inviteCode.value"
            :error="actions.error.value"
            :submitting="actions.submitting.value"
            @update:player-name="actions.playerName.value = $event"
            @update:invite-code="actions.inviteCode.value = $event"
            @submit="actions.handleJoin()"
          />
        </div>
      </Transition>
    </div>
  </div>
</template>

<style scoped>
.home-root {
  min-height: 100dvh;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: clamp(1.25rem, 4vw, 3rem);
}

.home-card {
  width: min(100%, 1040px);
  background: var(--color-panel);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-xl);
  padding: clamp(1.25rem, 3vw, 2.25rem);
  box-shadow:
    0 24px 64px rgba(0, 0, 0, 0.65),
    0 0 0 1px rgba(255, 255, 255, 0.03) inset;
  position: relative;
  overflow: hidden;
}

.home-card-compact {
  max-width: 440px;
}

.home-card-wide {
  max-width: 1040px;
}

.home-top-line {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(249, 115, 22, 0.4), transparent);
}

.home-hero {
  text-align: center;
  margin-bottom: 1.25rem;
}

.home-logo-wrap {
  width: 44px;
  height: 44px;
  margin: 0 auto 0.75rem;
  background: var(--color-elevated);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-lg);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.35rem;
  box-shadow: 0 0 24px rgba(249, 115, 22, 0.18);
}

.home-logo-icon {
  line-height: 1;
}

.home-title {
  font-size: 1.625rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  background: linear-gradient(135deg, #f0f0f5 0%, #7878a0 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin-bottom: 0.25rem;
  line-height: 1.2;
}

.home-sub {
  font-size: 0.875rem;
  color: var(--color-muted-foreground);
  font-weight: 400;
}
</style>
