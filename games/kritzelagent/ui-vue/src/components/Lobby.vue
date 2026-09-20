<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { MAX_PLAYERS, MIN_PLAYERS } from '@shared/constants';
import type { PlayerView } from '@shared/types';

const props = defineProps<{
  players: PlayerView[];
  isHost: boolean;
  canStart: boolean;
  pending: boolean;
}>();

const { t } = useI18n();
const playerCount = computed(() => props.players.filter((player) => player.connected).length);

defineEmits<{ start: [] }>();
</script>

<template>
  <section
    class="ui-panel kritzelagent-lobby"
    data-testid="kritzelagent-lobby"
    aria-labelledby="lobby-title"
  >
    <p class="text-sm text-muted-foreground">
      {{ t('kritzelagent.lobby.subtitle', { min: MIN_PLAYERS, max: MAX_PLAYERS }) }}
    </p>
    <h2 id="lobby-title" data-phase-focus tabindex="-1">
      {{ t('kritzelagent.lobby.title') }}
    </h2>
    <p class="mt-2">{{ t('kritzelagent.lobby.intro') }}</p>
    <h3 class="mt-5 text-lg font-semibold">
      {{ t('kritzelagent.lobby.players', { count: playerCount, max: MAX_PLAYERS }) }}
    </h3>
    <ul class="kritzelagent-player-list" :aria-label="t('kritzelagent.lobby.playersLabel')">
      <li v-for="player in players" :key="player.id">
        <span
          >{{ player.name
          }}<span v-if="player.isHost" class="ml-1">{{ t('kritzelagent.lobby.host') }}</span></span
        >
        <span :class="player.connected ? 'text-success' : 'text-muted-foreground'">{{
          player.connected ? t('kritzelagent.lobby.ready') : t('kritzelagent.lobby.offline')
        }}</span>
      </li>
    </ul>
    <button
      v-if="isHost"
      class="ui-btn-primary ui-btn-lg mt-5"
      type="button"
      :disabled="!canStart || pending"
      @click="$emit('start')"
    >
      {{
        pending
          ? t('kritzelagent.lobby.starting')
          : canStart
            ? t('kritzelagent.lobby.start')
            : t('kritzelagent.lobby.needPlayers', { min: MIN_PLAYERS })
      }}
    </button>
    <p v-else class="mt-4 text-sm text-muted-foreground" role="status">
      {{ t('kritzelagent.lobby.waitingForHost') }}
    </p>
  </section>
</template>

<style scoped>
.kritzelagent-lobby {
  display: grid;
  gap: 0.35rem;
}
.kritzelagent-lobby h2 {
  margin-top: 0.25rem;
  font-size: 1.35rem;
  font-weight: 700;
}
.kritzelagent-player-list {
  display: grid;
  gap: 0.35rem;
  margin-top: 0.75rem;
  padding: 0;
  list-style: none;
}
.kritzelagent-player-list li {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  border-bottom: 1px solid var(--color-border);
  padding: 0.45rem 0;
}
</style>
