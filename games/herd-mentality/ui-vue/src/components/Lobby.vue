<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { PlayerView } from '@shared/types';
import SettingStepper from '@platform/components/SettingStepper.vue';
import {
  MAX_TARGET_COWS,
  MAX_TOTAL_ROUNDS,
  MIN_PLAYERS,
  MIN_TARGET_COWS,
  MIN_TOTAL_ROUNDS,
} from '@shared/constants';

const props = defineProps<{
  players: PlayerView[];
  isHost: boolean;
  canStart: boolean;
  pending: boolean;
  settingsPending: boolean;
  totalRounds: number;
  targetCows: number;
}>();
const { t } = useI18n();
const emit = defineEmits<{
  start: [];
  updateSettings: [settings: { totalRounds?: number; targetCows?: number }];
}>();
const connected = computed(() => props.players.filter((player) => player.connected).length);
</script>
<template>
  <section
    class="ui-panel"
    data-testid="herd-mentality-lobby"
    aria-labelledby="herd-mentality-lobby-title"
  >
    <p class="text-sm text-muted-foreground">
      {{ t('herd-mentality.lobby.subtitle', { rounds: totalRounds }) }}
    </p>
    <h2
      id="herd-mentality-lobby-title"
      class="mt-2 text-xl font-semibold"
      data-phase-focus
      tabindex="-1"
    >
      {{ t('herd-mentality.lobby.title') }}
    </h2>
    <ul class="ui-player-list mt-4" :aria-label="t('herd-mentality.lobby.players')">
      <li v-for="player in players" :key="player.id" class="ui-player-item">
        <span class="ui-avatar" aria-hidden="true">{{ player.name.charAt(0).toUpperCase() }}</span>
        <span>{{ player.name }}</span
        ><span v-if="player.isHost" class="ui-badge">{{ t('herd-mentality.lobby.host') }}</span>
        <span v-if="!player.connected" class="ui-badge">{{
          t('herd-mentality.lobby.disconnected')
        }}</span>
      </li>
    </ul>
    <p class="mt-3 text-muted-foreground" aria-live="polite">
      {{
        t('herd-mentality.lobby.summary', {
          connected,
          total: players.length,
          min: MIN_PLAYERS,
        })
      }}
    </p>
    <div v-if="isHost" class="mt-4 flex flex-col gap-3">
      <SettingStepper
        :label="t('herd-mentality.lobby.rounds')"
        align-label
        :value="totalRounds"
        :min="MIN_TOTAL_ROUNDS"
        :max="MAX_TOTAL_ROUNDS"
        :disabled="settingsPending"
        test-id="herd-mentality-rounds"
        @change="emit('updateSettings', { totalRounds: $event })"
      />
      <SettingStepper
        :label="t('herd-mentality.lobby.targetCows')"
        align-label
        :value="targetCows"
        :min="MIN_TARGET_COWS"
        :max="MAX_TARGET_COWS"
        :disabled="settingsPending"
        test-id="herd-mentality-target-cows"
        @change="emit('updateSettings', { targetCows: $event })"
      />
    </div>
    <div v-if="isHost" class="mt-4">
      <button
        class="ui-btn-primary ui-btn-lg"
        type="button"
        data-testid="herd-mentality-start"
        :disabled="!canStart || pending || settingsPending"
        @click="emit('start')"
      >
        {{ pending ? t('herd-mentality.lobby.starting') : t('herd-mentality.lobby.start') }}
      </button>
      <p v-if="!canStart" class="mt-2 text-sm text-muted-foreground">
        {{ t('herd-mentality.lobby.needPlayers') }}
      </p>
    </div>
    <p v-else class="mt-4 text-muted-foreground" role="status">
      {{ t('herd-mentality.lobby.waitingForHost') }}
    </p>
  </section>
</template>
