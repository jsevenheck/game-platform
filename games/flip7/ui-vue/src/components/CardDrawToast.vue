<script setup lang="ts">
import { computed } from 'vue';
import type { DrawnCardInfo } from '../stores/game';

const props = defineProps<{
  card: DrawnCardInfo;
  /** null = local player ("You drew"); string = another player's name ("{Name} drew") */
  drawerName: string | null;
}>();

const label = computed(() => (props.drawerName ? `${props.drawerName} drew` : 'You drew'));

/** Main display text – short bold text that inherits the accent colour. */
const cardText = computed(() => {
  switch (props.card.kind) {
    case 'number':
      return String(props.card.value);
    case 'modifierAdd':
      return `+${props.card.bonus}`;
    case 'modifierX2':
      return '×2';
    case 'action':
      // Text abbreviations so they inherit the accent colour, same as number cards.
      return { freeze: 'FRZ', flipThree: '×3', secondChance: '2nd' }[props.card.action];
    default:
      return '';
  }
});

const cardSubtext = computed(() => {
  switch (props.card.kind) {
    case 'number':
      return 'Number Card';
    case 'modifierAdd':
      return 'Bonus';
    case 'modifierX2':
      return 'Double Up!';
    case 'action':
      return { freeze: 'Freeze', flipThree: 'Flip Three', secondChance: '2nd Chance' }[
        props.card.action
      ];
    default:
      return '';
  }
});

/** Ring / text / glow colour classes. bg-panel is applied in the template. */
const accentClasses = computed(() => {
  switch (props.card.kind) {
    case 'number':
      if (props.card.value <= 4)
        return 'ring-2 ring-flip7 text-flip7 shadow-[0_0_32px_rgba(245,158,11,0.35)]';
      if (props.card.value <= 8)
        return 'ring-2 ring-flip7-hover text-flip7-hover shadow-[0_0_32px_rgba(217,119,6,0.45)]';
      return 'ring-2 ring-danger text-danger shadow-[0_0_32px_rgba(239,68,68,0.45)]';
    case 'modifierAdd':
      return 'ring-2 ring-success text-success shadow-[0_0_32px_rgba(34,197,94,0.45)]';
    case 'modifierX2':
      return 'ring-2 ring-flip7 text-flip7 shadow-[0_0_32px_rgba(245,158,11,0.45)]';
    case 'action':
      switch (props.card.action) {
        case 'freeze':
          return 'ring-2 ring-signals text-signals shadow-[0_0_32px_rgba(6,182,212,0.45)]';
        case 'flipThree':
          return 'ring-2 ring-warning text-warning shadow-[0_0_32px_rgba(234,179,8,0.45)]';
        case 'secondChance':
          return 'ring-2 ring-success text-success shadow-[0_0_32px_rgba(34,197,94,0.45)]';
        default:
          return '';
      }
    default:
      return '';
  }
});
</script>

<template>
  <Teleport to="body">
    <div class="pointer-events-none fixed inset-x-0 top-24 z-50 flex justify-center">
      <div
        class="toast-chip flex min-w-[120px] flex-col items-center gap-1.5 rounded-2xl bg-panel px-8 py-5"
        :class="accentClasses"
      >
        <span class="text-[10px] font-semibold uppercase tracking-widest opacity-50">{{
          label
        }}</span>
        <span class="text-5xl font-black leading-none tracking-tight font-mono-num">{{
          cardText
        }}</span>
        <span class="text-xs font-bold opacity-70">{{ cardSubtext }}</span>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.toast-chip {
  animation: toast-pop 2.7s cubic-bezier(0.22, 1, 0.36, 1) forwards;
}

@keyframes toast-pop {
  0% {
    opacity: 0;
    transform: translateY(-20px) scale(0.78);
  }
  8% {
    opacity: 1;
    transform: translateY(4px) scale(1.07);
  }
  14% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
  74% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
  100% {
    opacity: 0;
    transform: translateY(-12px) scale(0.92);
  }
}
</style>
