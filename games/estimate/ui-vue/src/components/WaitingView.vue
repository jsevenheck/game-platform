<script setup lang="ts">
defineProps<{
  submitted: number;
  total: number;
}>();
</script>

<template>
  <div class="ui-panel text-center" data-testid="estimate-waiting">
    <p class="ui-section-label">Warte auf Mitspieler…</p>
    <p class="mt-2 text-2xl font-semibold">{{ submitted }} / {{ total }}</p>
    <p class="text-muted-foreground mt-1">Schätzungen abgegeben</p>
  </div>
</template>
