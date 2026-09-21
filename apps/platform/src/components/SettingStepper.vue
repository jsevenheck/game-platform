<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

const props = withDefaults(
  defineProps<{
    label: string;
    value: number;
    min: number;
    max: number;
    step?: number;
    disabled?: boolean;
    /** Keeps the label visually hidden when a surrounding heading already names the setting. */
    hideLabel?: boolean;
    /** Gives the label a fixed width so stacked steppers line up. */
    alignLabel?: boolean;
    testId?: string;
    /** Formats the displayed value (defaults to the plain number). */
    format?: (value: number) => string;
  }>(),
  {
    step: 1,
    disabled: false,
    hideLabel: false,
    alignLabel: false,
    testId: 'setting-stepper',
    format: undefined,
  }
);

const emit = defineEmits<{ change: [value: number] }>();
const { t } = useI18n();

const display = computed(() => (props.format ? props.format(props.value) : String(props.value)));

function adjust(direction: 1 | -1) {
  const next = Math.min(props.max, Math.max(props.min, props.value + direction * props.step));
  if (next !== props.value) emit('change', next);
}
</script>

<template>
  <div class="setting-stepper flex items-center gap-3" :data-testid="testId">
    <span :class="{ 'sr-only': hideLabel, 'label-aligned': alignLabel }">{{ label }}</span>
    <button
      class="ui-stepper-btn"
      type="button"
      :aria-label="t('stepper.decrease', { label })"
      :disabled="disabled || value <= min"
      :data-testid="`${testId}-minus`"
      @click="adjust(-1)"
    >
      −
    </button>
    <span
      class="min-w-8 text-center text-2xl font-bold tabular-nums"
      aria-live="polite"
      :data-testid="`${testId}-value`"
      >{{ display }}</span
    >
    <button
      class="ui-stepper-btn"
      type="button"
      :aria-label="t('stepper.increase', { label })"
      :disabled="disabled || value >= max"
      :data-testid="`${testId}-plus`"
      @click="adjust(1)"
    >
      +
    </button>
  </div>
</template>

<style scoped>
.label-aligned {
  min-width: 7rem;
}
</style>
