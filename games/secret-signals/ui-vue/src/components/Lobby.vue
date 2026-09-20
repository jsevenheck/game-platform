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
  <div class="lobby flex flex-col items-center gap-8 px-4 py-8">
    <div class="w-full max-w-[320px]">
      <h3 class="text-muted mb-3">
        {{ t('secret-signals.lobby.players', { count: connectedCount }) }}
      </h3>
      <div
        v-for="player in store.room?.players"
        :key="player.id"
        class="flex items-center gap-2 px-3 py-2 bg-elevated rounded-sm mb-2"
        :class="{ 'opacity-50': !player.connected }"
      >
        <span class="flex-1 text-foreground">{{ player.name }}</span>
        <span v-if="player.isHost" class="ui-badge bg-signals text-white">{{
          t('secret-signals.lobby.host')
        }}</span>
        <span v-if="!player.connected" class="ui-badge bg-border-strong text-muted-foreground">{{
          t('secret-signals.lobby.offline')
        }}</span>
      </div>
    </div>

    <TeamSetup
      ref="teamSetupRef"
      @assign-team="(team) => emit('assign-team', team)"
      @assign-role="(role) => emit('assign-role', role)"
      @set-team-count="(count) => emit('set-team-count', count)"
      @set-assassin-penalty-mode="(mode) => emit('set-assassin-penalty-mode', mode)"
    />

    <div v-if="isHost" class="flex flex-col items-center gap-4">
      <button
        class="ui-btn-primary ui-btn-lg btn-signals btn-signals-hover"
        :disabled="!canStart"
        @click="$emit('start-game')"
      >
        {{ t('secret-signals.lobby.start') }}
      </button>
      <p v-if="connectedCount < store.minimumPlayers" class="text-muted-foreground text-sm">
        {{ t('secret-signals.lobby.needPlayers', { min: store.minimumPlayers }) }}
      </p>
    </div>

    <div v-else class="text-muted-foreground">
      <p>{{ t('secret-signals.lobby.waitingForHost') }}</p>
    </div>
  </div>
</template>

<style scoped>
.btn-signals {
  background: var(--color-signals);
}
.btn-signals-hover:hover:not(:disabled) {
  background: var(--color-signals-hover);
}
</style>
