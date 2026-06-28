<script setup lang="ts">
import { ref } from 'vue';
import type { HomeTab, HomeTabId } from '../../composables/useHomeTabs';

const props = defineProps<{
  modelValue: HomeTabId;
  tabs: readonly HomeTab[];
}>();

const emit = defineEmits<{
  'update:modelValue': [HomeTabId];
}>();

// Index of the tab that currently holds keyboard focus (roving tabindex).
const focusedIndex = ref(0);

function tabId(tab: HomeTabId): string {
  return `home-tab-${tab}`;
}

function panelId(tab: HomeTabId): string {
  return `home-panel-${tab}`;
}

function activate(tab: HomeTabId): void {
  emit('update:modelValue', tab);
}

function moveFocus(nextIndex: number): void {
  focusedIndex.value = nextIndex;
  document.getElementById(tabId(props.tabs[nextIndex]!.id))?.focus();
}

/**
 * Move focus to the panel's first focusable control. With `<Transition mode="out-in">`
 * the new panel mounts only after the leave transition, so poll on rAF until it appears.
 */
function focusPanelFirstControl(tab: HomeTabId): void {
  let attempts = 0;
  const tryFocus = () => {
    const panel = document.getElementById(panelId(tab));
    const target = panel?.querySelector<HTMLElement>('input, button, select, textarea');
    if (target) {
      target.focus();
    } else if (attempts++ < 30) {
      requestAnimationFrame(tryFocus);
    }
  };
  requestAnimationFrame(tryFocus);
}

function onKeydown(event: KeyboardEvent, index: number): void {
  const count = props.tabs.length;

  switch (event.key) {
    case 'ArrowRight':
      event.preventDefault();
      moveFocus((index + 1) % count);
      break;
    case 'ArrowLeft':
      event.preventDefault();
      moveFocus((index - 1 + count) % count);
      break;
    case 'Home':
      event.preventDefault();
      moveFocus(0);
      break;
    case 'End':
      event.preventDefault();
      moveFocus(count - 1);
      break;
    case 'Enter':
    case ' ':
    case 'Spacebar': {
      event.preventDefault();
      activate(props.tabs[index]!.id);
      // Move focus to the panel's first focusable control.
      focusPanelFirstControl(props.tabs[index]!.id);
      break;
    }
    default:
      break;
  }
}
</script>

<template>
  <!-- Desktop pill tabs (WAI-ARIA tabs, manual activation) -->
  <div
    class="home-tabbar-desktop"
    role="tablist"
    aria-label="Home navigation"
    data-testid="home-tabbar"
  >
    <button
      v-for="(tab, index) in tabs"
      :id="tabId(tab.id)"
      :key="tab.id"
      type="button"
      role="tab"
      class="home-tabbar-tab"
      :class="{ 'home-tabbar-tab--active': tab.id === modelValue }"
      :aria-selected="tab.id === modelValue ? 'true' : 'false'"
      :aria-controls="panelId(tab.id)"
      :tabindex="tab.id === modelValue || index === focusedIndex ? 0 : -1"
      @click="activate(tab.id)"
      @focus="focusedIndex = index"
      @keydown="onKeydown($event, index)"
    >
      <span class="home-tabbar-icon" aria-hidden="true">{{ tab.icon }}</span>
      <span>{{ tab.label }}</span>
    </button>
  </div>

  <!-- Mobile native select -->
  <div class="home-tabbar-mobile">
    <label for="home-tabbar-select" class="home-label">View</label>
    <select
      id="home-tabbar-select"
      class="ui-input"
      :value="modelValue"
      data-testid="home-tabbar-select"
      @change="activate(($event.target as HTMLSelectElement).value as HomeTabId)"
    >
      <option v-for="tab in tabs" :key="tab.id" :value="tab.id">
        {{ tab.icon }} {{ tab.label }}
      </option>
    </select>
  </div>
</template>

<style scoped>
.home-tabbar-desktop {
  display: flex;
  gap: 4px;
  padding: 4px;
  background: var(--color-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
}

.home-tabbar-tab {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  padding: 0.55rem 0.75rem;
  border: none;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--color-muted-foreground);
  font: inherit;
  font-weight: 600;
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 200ms ease;
}

.home-tabbar-tab:hover:not(.home-tabbar-tab--active) {
  color: var(--color-muted);
  background: rgba(255, 255, 255, 0.04);
}

.home-tabbar-tab--active {
  background: var(--color-panel);
  color: var(--color-foreground);
  box-shadow: 0 1px 6px rgba(0, 0, 0, 0.5);
}

.home-tabbar-icon {
  font-size: 0.95rem;
  line-height: 1;
}

.home-tabbar-mobile {
  display: none;
  flex-direction: column;
  gap: 0.375rem;
}

.home-label {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--color-muted);
  letter-spacing: 0.02em;
}

/* Below 640px: hide pills, show native select. */
@media (max-width: 639px) {
  .home-tabbar-desktop {
    display: none;
  }
  .home-tabbar-mobile {
    display: flex;
  }
}
</style>
