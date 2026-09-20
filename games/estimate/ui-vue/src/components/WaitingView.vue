<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

defineProps<{
  submitted: number;
  total: number;
  myGuess: number | null;
}>();

const { t, locale } = useI18n();
const numberFormatter = computed(
  () => new Intl.NumberFormat(locale.value, { maximumFractionDigits: 6 })
);
</script>

<template>
  <section
    class="ui-panel text-center"
    data-testid="estimate-waiting"
    aria-labelledby="estimate-waiting-title"
  >
    <h2 id="estimate-waiting-title" class="text-xl font-semibold" data-phase-focus tabindex="-1">
      {{ t('estimate.waiting.saved') }}
    </h2>
    <p v-if="myGuess !== null" class="mt-2">
      {{ t('estimate.waiting.yourGuess') }} <strong>{{ numberFormatter.format(myGuess) }}</strong>
    </p>
    <p class="mt-4 text-2xl font-semibold" aria-live="polite">{{ submitted }} / {{ total }}</p>
    <p class="text-muted-foreground mt-1">
      {{ t('estimate.waiting.connectedGuessed') }}
    </p>
    <p class="text-muted-foreground mt-3">{{ t('estimate.waiting.waiting') }}</p>
  </section>
</template>
