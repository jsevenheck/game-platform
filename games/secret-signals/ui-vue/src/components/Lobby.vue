<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import type { AssassinPenaltyMode, PlayerRole, PlayerView, TeamColor } from '@shared/types';
import { useGameStore } from '../stores/game';
import TeamSetup from './TeamSetup.vue';

const { t } = useI18n();
const store = useGameStore();

const emit = defineEmits<{
  'start-game': [];
  'assign-team': [team: TeamColor];
  'assign-role': [role: PlayerRole];
  'set-team-count': [count: number];
  'set-assassin-penalty-mode': [mode: AssassinPenaltyMode];
}>();

const isHost = computed(
  () => store.room?.players.find((p: PlayerView) => p.id === store.playerId)?.isHost ?? false
);
const connectedCount = computed(
  () => store.room?.players.filter((p: PlayerView) => p.connected).length ?? 0
);
const teamSetupRef = ref<InstanceType<typeof TeamSetup> | null>(null);
const canStart = computed(() => {
  return (
    connectedCount.value >= store.minimumPlayers && (teamSetupRef.value?.isSetupValid ?? false)
  );
});
</script>

<template>
  <div class="lobby">
    <header class="lobby-header">
      <h2>{{ t('secret-signals.setup.yourSeat') }}</h2>
      <span class="player-count">{{
        t('secret-signals.lobby.players', { count: connectedCount })
      }}</span>
    </header>

    <TeamSetup
      ref="teamSetupRef"
      @assign-team="(team) => emit('assign-team', team)"
      @assign-role="(role) => emit('assign-role', role)"
      @set-team-count="(count) => emit('set-team-count', count)"
      @set-assassin-penalty-mode="(mode) => emit('set-assassin-penalty-mode', mode)"
    />

    <details class="players-panel">
      <summary>{{ t('secret-signals.lobby.players', { count: connectedCount }) }}</summary>
      <div class="players-list">
        <div
          v-for="player in store.room?.players"
          :key="player.id"
          class="player-row"
          :class="{ 'is-offline': !player.connected }"
        >
          <span class="player-name">{{ player.name }}</span>
          <span v-if="player.isHost" class="ui-badge host-badge">{{
            t('secret-signals.lobby.host')
          }}</span>
          <span v-if="!player.connected" class="ui-badge offline-badge">{{
            t('secret-signals.lobby.offline')
          }}</span>
        </div>
      </div>
    </details>

    <footer class="lobby-action">
      <template v-if="isHost">
        <button
          class="ui-btn-primary ui-btn-lg start-button"
          :disabled="!canStart"
          @click="$emit('start-game')"
        >
          {{ t('secret-signals.lobby.start') }}
        </button>
        <p v-if="connectedCount < store.minimumPlayers">
          {{ t('secret-signals.lobby.needPlayers', { min: store.minimumPlayers }) }}
        </p>
      </template>
      <p v-else>{{ t('secret-signals.lobby.waitingForHost') }}</p>
    </footer>
  </div>
</template>

<style scoped>
.lobby {
  --setup-shell: #102d35;
  --setup-panel: #163943;
  --setup-paper: #f2e8d5;
  --setup-muted: #b9c9c8;
  width: 100%;
  max-width: 760px;
  min-width: 0;
  margin-inline: auto;
  padding: 16px 12px 24px;
  display: grid;
  gap: 20px;
  color: var(--setup-paper);
  background: var(--setup-shell);
  border-radius: 12px;
}
.lobby-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding-bottom: 12px;
  border-bottom: 1px solid #36545a;
}
.lobby-header h2 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 800;
}
.player-count {
  font-size: 0.8rem;
  color: var(--setup-muted);
}
.players-panel {
  min-width: 0;
  padding: 0 14px;
  border: 1px solid #36545a;
  border-radius: 8px;
  background: var(--setup-panel);
}
.players-panel summary {
  min-height: 44px;
  padding-block: 12px;
  cursor: pointer;
  margin: 0 0 10px;
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--setup-muted);
}
.players-list {
  padding-bottom: 14px;
  display: grid;
  gap: 8px;
}
.player-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.player-name {
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
  font-size: 0.875rem;
}
.host-badge {
  background: var(--setup-paper);
  color: var(--setup-shell);
}
.offline-badge {
  background: #36545a;
  color: var(--setup-paper);
}
.is-offline {
  opacity: 0.65;
}
.lobby-action {
  display: grid;
  gap: 10px;
  text-align: center;
}
.start-button {
  width: 100%;
  min-height: 48px;
  white-space: normal;
  background: var(--setup-paper);
  color: var(--setup-shell);
  border: 2px solid var(--setup-paper);
  border-radius: 8px;
}
.start-button:hover:not(:disabled) {
  background: #fff7e8;
}
.start-button:focus-visible {
  outline: 3px solid var(--setup-paper);
  outline-offset: 4px;
}
.start-button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.lobby-action p {
  margin: 0;
  color: var(--setup-muted);
  font-size: 0.8rem;
  overflow-wrap: anywhere;
}
@media (min-width: 640px) {
  .lobby {
    padding: 24px;
  }
  .players-list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
