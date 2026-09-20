<script setup lang="ts">
import { useI18n } from 'vue-i18n';

defineProps<{
  canStay?: boolean;
}>();

const { t } = useI18n();
const emit = defineEmits<{
  hit: [];
  stay: [];
}>();
</script>

<template>
  <div class="flex gap-3">
    <button
      class="ui-btn-primary btn-flip7 flex-1 text-lg font-bold"
      type="button"
      @click="emit('hit')"
    >
      {{ t('flip7.controls.hit') }} 🃏
    </button>
    <button
      class="ui-btn-secondary flex-1 text-lg font-bold"
      type="button"
      :disabled="canStay === false"
      @click="emit('stay')"
    >
      {{ t('flip7.controls.stay') }} ✋
    </button>
  </div>
</template>

<style scoped>
.btn-flip7 {
  background: var(--color-flip7);
  color: var(--color-canvas);
}

.btn-flip7:hover:not(:disabled) {
  background: var(--color-flip7-hover);
}
</style>
