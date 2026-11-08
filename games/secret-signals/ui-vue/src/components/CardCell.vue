<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { TEAM_HEX_BY_COLOR } from '@shared/constants';
import type { CardView, TeamColor } from '@shared/types';
import { CARD_HEX_BY_TYPE, getCardTextHex } from '../lib/teamTheme';

const props = defineProps<{
  card: CardView;
  clickable: boolean;
  pending?: boolean;
  isDirectorView: boolean;
  isFocused: boolean;
  focusedByName: string | null;
  focusedByColor: TeamColor | null;
}>();
defineEmits<{ select: [] }>();
const { t } = useI18n();
// Ownership is only rendered when this viewer is authorized to see it.
const visibleType = computed(() =>
  props.card.revealed || props.isDirectorView ? props.card.type : null
);
const typeLabel = computed(() => {
  const type = visibleType.value;
  if (!type) return '';
  return type === 'neutral' || type === 'assassin'
    ? t(`secret-signals.cards.${type}`)
    : t(`secret-signals.teams.${type}`);
});
const accessibleLabel = computed(() =>
  [
    props.card.word,
    typeLabel.value,
    props.card.revealed ? t('secret-signals.cards.revealed') : '',
    props.isFocused && props.focusedByName
      ? t('secret-signals.cards.markedBy', { name: props.focusedByName })
      : '',
  ]
    .filter(Boolean)
    .join(', ')
);
const cardStyle = computed(() => ({
  backgroundColor: visibleType.value ? CARD_HEX_BY_TYPE[visibleType.value] : '#f2e8d5',
  color: getCardTextHex(visibleType.value),
  '--marker-color': props.focusedByColor ? TEAM_HEX_BY_COLOR[props.focusedByColor] : '#f2e8d5',
}));
</script>

<template>
  <button
    type="button"
    class="card-cell"
    :aria-label="accessibleLabel"
    :aria-pressed="clickable ? isFocused : undefined"
    :class="{
      revealed: card.revealed,
      clickable: clickable && !card.revealed,
      assassin: visibleType === 'assassin',
      'director-view': isDirectorView && !card.revealed,
      focused: isFocused,
    }"
    :style="cardStyle"
    :disabled="!clickable || card.revealed"
    :aria-disabled="pending || !clickable || card.revealed"
    @click="!pending && clickable && !card.revealed && $emit('select')"
  >
    <span class="card-word">{{ card.word }}</span>
    <svg
      v-if="card.revealed"
      class="reveal-check"
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="3"
      aria-hidden="true"
    >
      <path d="m5 12 4 4L19 6" />
    </svg>
    <svg
      v-else-if="visibleType === 'assassin'"
      class="reveal-check"
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2.5"
      aria-hidden="true"
    >
      <path d="m6 6 12 12M6 18 18 6" />
    </svg>
    <span v-if="isFocused && focusedByName" class="focus-chip" aria-hidden="true">{{
      focusedByName
    }}</span>
  </button>
</template>

<style scoped>
.card-cell {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.2rem;
  width: 100%;
  min-width: 0;
  min-height: 4rem;
  aspect-ratio: 1.35;
  padding: 0.5rem 0.2rem;
  border: 2px solid rgb(7 23 28 / 18%);
  border-radius: 0.4rem;
  font-size: clamp(0.75rem, 2.8vw, 1rem);
  font-weight: 800;
  line-height: 1.15;
  letter-spacing: 0.01em;
  text-transform: uppercase;
  text-align: center;
  box-shadow: 0 2px 3px rgb(0 0 0 / 16%);
  user-select: none;
  transition:
    background-color 180ms ease-out,
    box-shadow 180ms ease-out;
}
.card-word {
  width: 100%;
  overflow-wrap: anywhere;
}
.card-cell:disabled {
  opacity: 1;
  cursor: default;
}
.card-cell.clickable {
  cursor: pointer;
  touch-action: manipulation;
}
.card-cell.clickable:hover {
  box-shadow: 0 4px 10px rgb(0 0 0 / 30%);
}
.card-cell:focus-visible {
  outline: 3px solid #fff;
  outline-offset: 3px;
  z-index: 2;
}
.card-cell.revealed {
  border-color: currentColor;
  border-style: dashed;
}
.card-cell.focused {
  outline: 3px solid var(--marker-color);
  outline-offset: 2px;
  z-index: 1;
}
.card-cell.focused:focus-visible {
  outline-color: #fff;
}
.reveal-check {
  position: absolute;
  top: 2px;
  right: 2px;
}
.focus-chip {
  max-width: 100%;
  padding: 0.1rem 0.2rem;
  border-radius: 0.2rem;
  background: #102d35;
  color: #f4f7f6;
  font-size: 0.625rem;
  font-weight: 600;
  line-height: 1.2;
  text-transform: none;
  overflow-wrap: anywhere;
}
@media (min-width: 700px) {
  .card-cell {
    min-height: 5.5rem;
    aspect-ratio: 1.7;
    padding: 0.75rem 0.4rem;
  }
}
@media (prefers-reduced-motion: reduce) {
  .card-cell {
    transition: none;
  }
}
</style>
