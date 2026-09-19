<script setup lang="ts">
defineProps<{ submitted: number; total: number; myAnswer: string | null }>();
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
      Antwort gespeichert
    </h2>
    <p class="mt-3 text-2xl font-semibold" aria-live="polite">{{ submitted }} / {{ total }}</p>
    <p class="mt-1 text-muted-foreground">verbundene Spieler haben geantwortet</p>
    <p class="mt-4 text-muted-foreground">Deine Antwort bleibt geheim. Warte auf die Herde…</p>
  </section>
</template>
