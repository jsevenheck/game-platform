<script setup lang="ts">
import { useI18n } from 'vue-i18n';

defineProps<{ submitted: number; total: number; myAnswer: string | null }>();
const { t } = useI18n();
</script>
<template>
  <section
    class="ui-panel text-center"
    data-testid="herd-mentality-waiting"
    aria-labelledby="herd-mentality-waiting-title"
  >
    <h2
      id="herd-mentality-waiting-title"
      class="text-xl font-semibold"
      data-phase-focus
      tabindex="-1"
    >
      {{ t('herd-mentality.waiting.saved') }}
    </h2>
    <p class="mt-3 text-2xl font-semibold" aria-live="polite">{{ submitted }} / {{ total }}</p>
    <p class="mt-1 text-muted-foreground">
      {{ t('herd-mentality.waiting.connectedAnswered') }}
    </p>
    <p class="mt-4 text-muted-foreground">
      {{ t('herd-mentality.waiting.secret') }}
    </p>
  </section>
</template>
