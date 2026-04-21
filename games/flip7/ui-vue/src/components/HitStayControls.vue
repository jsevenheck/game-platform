<script setup lang="ts">
defineProps<{
  canStay?: boolean;
}>();

const emit = defineEmits<{
  hit: [];
  stay: [];
}>();
</script>

<template>
  <div class="flex gap-3">
    <button
      class="ui-btn-primary flex-1 bg-flip7! hover:bg-flip7-hover! text-lg font-bold"
      type="button"
      @click="emit('hit')"
    >
      Hit 🃏
    </button>
    <button
      class="ui-btn-secondary flex-1 text-lg font-bold"
      type="button"
      :disabled="canStay === false"
      @click="emit('stay')"
    >
      Stay ✋
    </button>
  </div>
</template>
