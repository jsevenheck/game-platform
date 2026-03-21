<script setup lang="ts">
import { computed, ref } from 'vue';
import type { AssassinPenaltyMode, PlayerRole, PlayerView, TeamColor } from '@shared/types';
import { useGameStore } from '../stores/game';
import TeamSetup from './TeamSetup.vue';

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
    <div class="room-code-display">
      <p class="label">Room Code</p>
      <h2 class="code">{{ store.roomCode }}</h2>
      <p class="hint">Share this code with your friends!</p>
    </div>

    <div class="players-list">
      <h3>Players ({{ connectedCount }})</h3>
      <div
        v-for="player in store.room?.players"
        :key="player.id"
        class="player-item"
        :class="{ disconnected: !player.connected }"
      >
        <span class="player-name">{{ player.name }}</span>
        <span v-if="player.isHost" class="badge host">Host</span>
        <span v-if="!player.connected" class="badge offline">Offline</span>
      </div>
    </div>

    <TeamSetup
      ref="teamSetupRef"
      @assign-team="(team) => emit('assign-team', team)"
      @assign-role="(role) => emit('assign-role', role)"
      @set-team-count="(count) => emit('set-team-count', count)"
      @set-assassin-penalty-mode="(mode) => emit('set-assassin-penalty-mode', mode)"
    />

    <div v-if="isHost" class="host-controls">
      <button class="btn btn-primary btn-start" :disabled="!canStart" @click="$emit('start-game')">
        Start Game
      </button>
      <p v-if="connectedCount < store.minimumPlayers" class="hint">
        Need at least {{ store.minimumPlayers }} connected players to start
      </p>
    </div>

    <div v-else class="waiting">
      <p>Waiting for host to start the game...</p>
    </div>
  </div>
</template>

<style scoped>
.lobby {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2rem;
  padding: 2rem 1rem;
}

.room-code-display {
  text-align: center;
}

.label {
  color: #71717a;
  text-transform: uppercase;
  font-size: 0.75rem;
  letter-spacing: 0.1em;
}

.code {
  font-size: 3rem;
  font-weight: 900;
  letter-spacing: 0.4em;
  color: #8b5cf6;
}

.hint {
  color: #71717a;
  font-size: 0.875rem;
}

.players-list {
  width: 100%;
  max-width: 320px;
}

.players-list h3 {
  color: #a1a1aa;
  margin-bottom: 0.75rem;
}

.player-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: #27272a;
  border-radius: 6px;
  margin-bottom: 0.5rem;
}

.player-item.disconnected {
  opacity: 0.5;
}

.player-name {
  flex: 1;
  color: #fff;
}

.badge {
  font-size: 0.7rem;
  padding: 0.15rem 0.5rem;
  border-radius: 4px;
  text-transform: uppercase;
  font-weight: 600;
}

.badge.host {
  background: #8b5cf6;
  color: #fff;
}

.badge.offline {
  background: #3f3f46;
  color: #71717a;
}

.host-controls {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.btn {
  padding: 0.75rem 2rem;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
}

.btn-primary {
  background: #8b5cf6;
  color: #fff;
}

.btn-primary:hover:not(:disabled) {
  background: #7c3aed;
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-start {
  padding: 1rem 3rem;
  font-size: 1.25rem;
}

.waiting {
  color: #71717a;
}
</style>
