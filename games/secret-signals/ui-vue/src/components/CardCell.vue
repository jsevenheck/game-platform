<script setup lang="ts">
import { TEAM_HEX_BY_COLOR } from '@shared/constants';
import type { CardView, TeamColor } from '@shared/types';
import { CARD_HEX_BY_TYPE, getCardTextHex } from '../lib/teamTheme';

const props = defineProps<{
  card: CardView;
  clickable: boolean;
  isDirectorView: boolean;
  isFocused: boolean;
  focusedByName: string | null;
  focusedByColor: TeamColor | null;
}>();

defineEmits<{
  select: [];
}>();

function cardBackground(): string {
  if (props.card.revealed && props.card.type) {
    return CARD_HEX_BY_TYPE[props.card.type] ?? '#27272a';
  }
  if (props.isDirectorView && props.card.type) {
    const color = CARD_HEX_BY_TYPE[props.card.type];
    if (props.card.type === 'assassin') return '#27272a';
    return color ? `${color}33` : '#27272a';
  }
  return '#27272a';
}

function textColor(): string {
  if (props.card.revealed) return getCardTextHex(props.card.type);
  if (props.isDirectorView && props.card.type === 'assassin') return '#ef4444';
  return '#e4e4e7';
}

function borderColor(): string {
  if (props.isFocused && props.focusedByColor) {
    return TEAM_HEX_BY_COLOR[props.focusedByColor];
  }
  if (props.isDirectorView && !props.card.revealed && props.card.type) {
    const color = CARD_HEX_BY_TYPE[props.card.type];
    if (props.card.type === 'assassin') return '#ef4444';
    return color ?? '#3f3f46';
  }
  return '#3f3f46';
}
</script>

<template>
  <button
    class="card-cell"
    :class="{
      revealed: card.revealed,
      clickable: clickable && !card.revealed,
      assassin: card.type === 'assassin',
      'director-view': isDirectorView && !card.revealed,
      focused: isFocused,
    }"
    :style="{
      backgroundColor: cardBackground(),
      color: textColor(),
      borderColor: borderColor(),
    }"
    :disabled="!clickable || card.revealed"
    @click="$emit('select')"
  >
    <span v-if="isFocused && focusedByName" class="focus-chip">
      {{ focusedByName }}
    </span>
    <span class="relative z-[1]">{{ card.word }}</span>
    <span v-if="isDirectorView && !card.revealed && card.type === 'assassin'" class="absolute top-1 right-1.5 text-xs opacity-70"
      >&#x2620;</span
    >
  </button>
</template>

<style scoped>
.card-cell {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  aspect-ratio: 3 / 2;
  border: 2px solid var(--color-border-strong);
  border-radius: var(--radius-sm);
  font-size: clamp(0.6rem, 1.4vw, 0.9rem);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  cursor: default;
  transition:
    background-color 0.4s ease,
    border-color 0.3s ease,
    transform 0.15s ease,
    box-shadow 0.15s ease;
  user-select: none;
  padding: 0.25rem;
  text-align: center;
  word-break: break-word;
  overflow: hidden;
}

.card-cell.clickable {
  cursor: pointer;
}

.card-cell.clickable:hover {
  transform: scale(1.04);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
  border-color: var(--color-signals);
}

.card-cell.revealed {
  opacity: 0.85;
  border-color: transparent;
}

.card-cell.focused {
  transform: translateY(-2px);
  box-shadow:
    0 0 0 2px rgba(255, 255, 255, 0.05),
    0 10px 24px rgba(0, 0, 0, 0.35);
}

.focus-chip {
  position: absolute;
  top: 6px;
  left: 6px;
  max-width: calc(100% - 12px);
  padding: 0.14rem 0.38rem;
  border-radius: var(--radius-pill);
  background: rgba(9, 9, 11, 0.78);
  color: var(--color-foreground);
  font-size: 0.62rem;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: none;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
