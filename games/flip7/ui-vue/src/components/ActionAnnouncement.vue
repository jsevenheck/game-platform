<script setup lang="ts">
import { computed } from 'vue';
import type { ActionAnnouncement } from '../stores/game';

const props = defineProps<{ announcement: ActionAnnouncement }>();

const meta = computed(() => {
  switch (props.announcement.action) {
    case 'freeze':
      return {
        emoji: '🧊',
        label: 'Freeze',
        verb: 'froze',
        verbSelf: 'froze themselves',
        colorClasses:
          'bg-signals-muted text-signals ring-2 ring-signals shadow-[0_0_28px_rgba(6,182,212,0.30)]',
      };
    case 'flipThree':
      return {
        emoji: '🔄',
        label: 'Flip Three',
        verb: "Flip Three'd",
        verbSelf: "Flip Three'd themselves",
        colorClasses:
          'bg-warning-muted text-warning ring-2 ring-warning shadow-[0_0_28px_rgba(234,179,8,0.30)]',
      };
    case 'secondChance':
      return {
        emoji: '🛡️',
        label: '2nd Chance',
        verb: 'gave 2nd Chance to',
        verbSelf: 'gave themselves 2nd Chance',
        colorClasses:
          'bg-success-muted text-success ring-2 ring-success shadow-[0_0_28px_rgba(34,197,94,0.30)]',
      };
  }
});

/** Human-readable single-line sentence. */
const sentence = computed(() => {
  const { drawerName, targetName, isSelf } = props.announcement;
  const { verb, verbSelf } = meta.value;
  return isSelf ? `${drawerName} ${verbSelf}!` : `${drawerName} ${verb} ${targetName}!`;
});
</script>

<template>
  <Teleport to="body">
    <div class="pointer-events-none fixed inset-x-0 top-44 z-40 flex justify-center px-4">
      <div
        class="announcement-chip flex max-w-xs flex-col items-center gap-1 rounded-2xl px-8 py-3.5"
        :class="meta.colorClasses"
      >
        <!-- action label row -->
        <div class="flex items-center gap-2">
          <span class="text-2xl leading-none">{{ meta.emoji }}</span>
          <span class="text-base font-black tracking-tight">{{ meta.label }}</span>
        </div>
        <!-- sentence -->
        <span class="text-center text-sm font-semibold leading-snug opacity-90">
          {{ sentence }}
        </span>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.announcement-chip {
  animation: announcement-pop 3.2s cubic-bezier(0.22, 1, 0.36, 1) forwards;
}

@keyframes announcement-pop {
  0% {
    opacity: 0;
    transform: translateY(14px) scale(0.84);
  }
  10% {
    opacity: 1;
    transform: translateY(-4px) scale(1.05);
  }
  17% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
  78% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
  100% {
    opacity: 0;
    transform: translateY(10px) scale(0.94);
  }
}
</style>
