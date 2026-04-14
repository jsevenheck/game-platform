<script setup lang="ts">
import { computed } from 'vue';
import type { DrawnCardInfo } from '../stores/game';

const props = defineProps<{ card: DrawnCardInfo }>();

const cardText = computed(() => {
  switch (props.card.kind) {
    case 'number':
      return String(props.card.value);
    case 'modifierAdd':
      return `+${props.card.bonus}`;
    case 'modifierX2':
      return '×2';
    case 'action':
      return { freeze: '🧊', flipThree: '🔄', secondChance: '🛡️' }[props.card.action];
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
  }
});

/** Returns the bg / text / ring colour classes based on card type */
const chipClasses = computed(() => {
  switch (props.card.kind) {
    case 'number':
      if (props.card.value <= 4)
        return 'bg-success-muted text-success ring-2 ring-success shadow-[0_0_20px_rgba(34,197,94,0.25)]';
      if (props.card.value <= 8)
        return 'bg-warning-muted text-warning ring-2 ring-warning shadow-[0_0_20px_rgba(234,179,8,0.25)]';
      return 'bg-danger-muted text-danger ring-2 ring-danger shadow-[0_0_20px_rgba(239,68,68,0.25)]';
    case 'modifierAdd':
      return 'bg-success-muted text-success ring-2 ring-success shadow-[0_0_20px_rgba(34,197,94,0.25)]';
    case 'modifierX2':
      return 'bg-flip7-muted text-flip7 ring-2 ring-flip7 shadow-[0_0_20px_rgba(245,158,11,0.25)]';
    case 'action':
      switch (props.card.action) {
        case 'freeze':
          return 'bg-signals-muted text-signals ring-2 ring-signals shadow-[0_0_20px_rgba(6,182,212,0.25)]';
        case 'flipThree':
          return 'bg-warning-muted text-warning ring-2 ring-warning shadow-[0_0_20px_rgba(234,179,8,0.25)]';
        case 'secondChance':
          return 'bg-success-muted text-success ring-2 ring-success shadow-[0_0_20px_rgba(34,197,94,0.25)]';
      }
  }
});
</script>

<template>
  <Teleport to="body">
    <div class="pointer-events-none fixed inset-x-0 top-24 z-50 flex justify-center">
      <div
        class="toast-chip flex min-w-[110px] flex-col items-center gap-1.5 rounded-2xl px-7 py-4"
        :class="chipClasses"
      >
        <span class="text-[10px] font-semibold uppercase tracking-widest opacity-60">You drew</span>
        <span class="text-5xl font-black leading-none tracking-tight">{{ cardText }}</span>
        <span class="text-xs font-bold opacity-75">{{ cardSubtext }}</span>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.toast-chip {
  animation: toast-pop 1.7s cubic-bezier(0.22, 1, 0.36, 1) forwards;
}

@keyframes toast-pop {
  0% {
    opacity: 0;
    transform: translateY(-20px) scale(0.78);
  }
  13% {
    opacity: 1;
    transform: translateY(4px) scale(1.07);
  }
  22% {
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
