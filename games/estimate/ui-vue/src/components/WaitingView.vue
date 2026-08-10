<script setup lang="ts">
defineProps<{
  submitted: number;
  total: number;
  myGuess: number | null;
}>();

const numberFormatter = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 6 });
</script>

<template>
  <section
    class="ui-panel text-center"
    data-testid="estimate-waiting"
    aria-labelledby="estimate-waiting-title"
  >
    <h2 id="estimate-waiting-title" class="text-xl font-semibold" data-phase-focus tabindex="-1">
      Schätzung gespeichert
    </h2>
    <p v-if="myGuess !== null" class="mt-2">
      Deine Schätzung: <strong>{{ numberFormatter.format(myGuess) }}</strong>
    </p>
    <p class="mt-4 text-2xl font-semibold" aria-live="polite">{{ submitted }} / {{ total }}</p>
    <p class="text-muted-foreground mt-1">verbundene Spieler haben geschätzt</p>
    <p class="text-muted-foreground mt-3">Warte auf die übrigen Mitspieler…</p>
  </section>
</template>
