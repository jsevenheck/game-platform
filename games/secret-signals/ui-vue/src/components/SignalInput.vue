<script setup lang="ts">
import { MAX_SIGNAL_NUMBER, TEAM_HEX_BY_COLOR } from '@shared/constants';
import type { TeamColor } from '@shared/types';
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';

defineProps<{
  disabled: boolean;
  teamColor: TeamColor | null;
}>();

const emit = defineEmits<{
  'give-signal': [word: string, number: number];
}>();

const { t } = useI18n();
const word = ref('');
const number = ref(1);
const error = ref('');

function submit() {
  const trimmed = word.value.trim();
  if (!trimmed) {
    error.value = t('secret-signals.signal.errorEmpty');
    return;
  }
  if (trimmed.includes(' ')) {
    error.value = t('secret-signals.signal.errorSingle');
    return;
  }
  if (number.value < 0 || number.value > MAX_SIGNAL_NUMBER) {
    error.value = t('secret-signals.signal.errorNumber', { max: MAX_SIGNAL_NUMBER });
    return;
  }
  error.value = '';
  emit('give-signal', trimmed, number.value);
  word.value = '';
  number.value = 1;
}
</script>

<template>
  <div class="flex flex-col items-center gap-2">
    <div class="flex items-center gap-2 flex-wrap justify-center">
      <input
        v-model="word"
        :aria-label="t('secret-signals.signal.clueWord')"
        type="text"
        :placeholder="t('secret-signals.signal.clueWord')"
        class="ui-input !w-40 !bg-white/5 !border-white/10 focus:!border-signals uppercase"
        :disabled="disabled"
        @keyup.enter="submit"
      />
      <div
        class="flex items-center bg-panel border-2 border-border-strong rounded-sm overflow-hidden"
      >
        <button
          :aria-label="t('secret-signals.signal.decrease')"
          class="w-11 h-11 bg-transparent border-none text-foreground/80 text-lg font-bold cursor-pointer hover:bg-border-strong disabled:opacity-30 disabled:cursor-not-allowed"
          :disabled="disabled || number <= 0"
          @click="number--"
        >
          -
        </button>
        <span class="w-7 text-center text-foreground font-bold">{{ number }}</span>
        <button
          :aria-label="t('secret-signals.signal.increase')"
          class="w-11 h-11 bg-transparent border-none text-foreground/80 text-lg font-bold cursor-pointer hover:bg-border-strong disabled:opacity-30 disabled:cursor-not-allowed"
          :disabled="disabled || number >= MAX_SIGNAL_NUMBER"
          @click="number++"
        >
          +
        </button>
      </div>
      <button
        class="ui-btn-primary !rounded-sm"
        :style="{
          backgroundColor: teamColor
            ? (TEAM_HEX_BY_COLOR[teamColor] ?? 'var(--color-signals)')
            : 'var(--color-signals)',
        }"
        :disabled="disabled"
        @click="submit"
      >
        {{ t('secret-signals.signal.send') }}
      </button>
    </div>
    <p v-if="error" role="alert" class="text-danger text-xs">{{ error }}</p>
    <p class="text-muted-foreground text-xs">{{ t('secret-signals.signal.unlimited') }}</p>
  </div>
</template>
