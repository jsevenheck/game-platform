<script setup lang="ts">
import type { RoomView } from '@shared/types';

withDefaults(
  defineProps<{
    wsNamespace?: string;
    sessionId?: string;
    playerName?: string;
    playerId?: string;
    joinToken?: string;
    isHost?: boolean;
  }>(),
  {
    wsNamespace: '/g/kritzelagent',
    sessionId: '',
    playerName: '',
    playerId: '',
    joinToken: '',
    isHost: false,
  }
);

defineEmits<{
  'phase-change': [phase: RoomView['phase']];
}>();
</script>

<template>
  <main class="kritzelagent-app" data-testid="kritzelagent-app">
    <h1>Kritzelagent</h1>
    <p>Der Spiel-Scaffold ist bereit für die Round-Lifecycle-Implementierung.</p>
  </main>
</template>
