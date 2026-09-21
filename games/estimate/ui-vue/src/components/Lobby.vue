<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import SettingStepper from '@platform/components/SettingStepper.vue';
import { MAX_TOTAL_ROUNDS, MIN_TOTAL_ROUNDS } from '@shared/constants';
import type { PlayerView } from '@shared/types';

const props = defineProps<{
  players: PlayerView[];
  isHost: boolean;
  canStart: boolean;
  pending: boolean;
  totalRounds: number;
}>();

const { t } = useI18n();
const emit = defineEmits<{ start: []; setRounds: [rounds: number] }>();
const connectedCount = computed(() => props.players.filter((player) => player.connected).length);
</script>

<template>
  <section class="ui-panel" data-testid="estimate-lobby" aria-labelledby="estimate-lobby-title">
    <h2 id="estimate-lobby-title" class="text-xl font-semibold" data-phase-focus tabindex="-1">
      {{ t('estimate.lobby.title') }}
    </h2>
    <ul class="ui-player-list mt-3" :aria-label="t('estimate.lobby.players')">
      <li v-for="player in players" :key="player.id" class="ui-player-item">
        <span class="ui-avatar" aria-hidden="true">{{ player.name.charAt(0).toUpperCase() }}</span>
        <span>{{ player.name }}</span>
        <span v-if="player.isHost" class="ui-badge">{{ t('estimate.lobby.host') }}</span>
        <span
          v-if="!player.connected"
          class="ui-badge disconnected-badge"
          :aria-label="t('estimate.lobby.disconnectedLabel', { name: player.name })"
        >
          {{ t('estimate.lobby.disconnected') }}
        </span>
      </li>
    </ul>
    <p class="text-muted-foreground mt-2" aria-live="polite">
      {{
        t('estimate.lobby.summary', {
          connected: connectedCount,
          total: players.length,
          rounds: totalRounds,
        })
      }}
    </p>
    <SettingStepper
      v-if="isHost"
      class="mt-4"
      :label="t('estimate.lobby.rounds')"
      :value="totalRounds"
      :min="MIN_TOTAL_ROUNDS"
      :max="MAX_TOTAL_ROUNDS"
      :disabled="pending"
      test-id="estimate-rounds"
      @change="emit('setRounds', $event)"
    />
    <div v-if="isHost" class="mt-4">
      <button
        class="ui-btn-primary ui-btn-lg"
        type="button"
        :disabled="!canStart || pending"
        data-testid="estimate-start"
        @click="emit('start')"
      >
        {{ pending ? t('estimate.lobby.starting') : t('estimate.lobby.start') }}
      </button>
      <p v-if="!canStart" class="text-muted-foreground mt-2 text-sm">
        {{ t('estimate.lobby.needPlayers') }}
      </p>
    </div>
    <p v-else class="text-muted-foreground mt-4" role="status">
      {{ t('estimate.lobby.waitingForHost') }}
    </p>
  </section>
</template>

<style scoped>
.disconnected-badge {
  color: var(--color-muted-foreground);
  border-color: currentColor;
}
</style>
