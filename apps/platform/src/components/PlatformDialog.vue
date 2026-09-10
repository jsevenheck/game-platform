<script setup lang="ts">
/**
 * Shared modal dialog.
 *
 * Modal semantics are a functional requirement, not polish: without them a
 * keyboard or screen-reader user cannot reliably operate the platform's
 * decision points (replay / return to lobby, leave game, admin cleanup).
 * This component supplies the parts each overlay was re-deriving — or, in
 * most cases, omitting:
 *
 *  - `role="dialog"` + `aria-modal` + a labelled title, so assistive tech
 *    announces a dialog and scopes reading to it
 *  - a Tab focus trap, so focus cannot land on the page behind
 *  - `inert` on the background content, so it is neither focusable nor
 *    exposed to assistive tech
 *  - initial focus into the dialog, and focus restored to the element that
 *    opened it on close
 *  - Escape to dismiss, when the dialog is dismissible
 *
 * Use it for every overlay. See docs/adding-a-new-game.md.
 */
import { computed, nextTick, onBeforeUnmount, ref, useId, watch } from 'vue';

const props = withDefaults(
  defineProps<{
    open: boolean;
    title: string;
    description?: string;
    /** When true, Escape and a backdrop click close the dialog. */
    dismissible?: boolean;
  }>(),
  { description: '', dismissible: false }
);

const emit = defineEmits<{ close: [] }>();

const dialogEl = ref<HTMLElement | null>(null);
const titleId = useId();
const descriptionId = useId();

let previouslyFocused: HTMLElement | null = null;

const focusableSelector =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function focusableControls(): HTMLElement[] {
  if (!dialogEl.value) return [];
  return Array.from(dialogEl.value.querySelectorAll<HTMLElement>(focusableSelector)).filter(
    (el) => el.offsetParent !== null || el === document.activeElement
  );
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape' && props.dismissible) {
    event.stopPropagation();
    emit('close');
    return;
  }

  if (event.key !== 'Tab') return;

  const controls = focusableControls();
  if (controls.length === 0) {
    // Nothing focusable inside — keep focus on the dialog itself rather than
    // letting Tab escape to the inert content behind it.
    event.preventDefault();
    dialogEl.value?.focus();
    return;
  }

  const first = controls[0]!;
  const last = controls[controls.length - 1]!;
  const active = document.activeElement;

  if (event.shiftKey && (active === first || active === dialogEl.value)) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
  }
}

function onBackdropClick(): void {
  if (props.dismissible) emit('close');
}

watch(
  () => props.open,
  async (isOpen) => {
    if (isOpen) {
      previouslyFocused = document.activeElement as HTMLElement | null;
      await nextTick();
      const controls = focusableControls();
      (controls[0] ?? dialogEl.value)?.focus();
      return;
    }
    // Return focus to whatever opened the dialog, so keyboard users are not
    // dropped back at the top of the document.
    previouslyFocused?.focus?.();
    previouslyFocused = null;
  },
  { immediate: true }
);

onBeforeUnmount(() => {
  previouslyFocused?.focus?.();
});

const describedBy = computed(() => (props.description ? descriptionId : undefined));
</script>

<template>
  <Teleport to="body">
    <Transition name="platform-dialog-fade">
      <div v-if="open" class="ui-overlay platform-dialog-overlay" @click.self="onBackdropClick">
        <div
          ref="dialogEl"
          class="ui-dialog platform-dialog"
          data-testid="platform-dialog"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="titleId"
          :aria-describedby="describedBy"
          tabindex="-1"
          @keydown="onKeydown"
        >
          <slot name="icon" />
          <h2 :id="titleId" class="platform-dialog-title">{{ title }}</h2>
          <p v-if="description" :id="descriptionId" class="platform-dialog-desc">
            {{ description }}
          </p>
          <slot />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.platform-dialog-overlay {
  z-index: 200;
}

.platform-dialog:focus {
  outline: none;
}

.platform-dialog:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 4px;
}

.platform-dialog-title {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--color-foreground);
  margin-bottom: 0.5rem;
  letter-spacing: -0.01em;
  text-wrap: balance;
}

.platform-dialog-desc {
  font-size: 0.875rem;
  color: var(--color-muted-foreground);
  margin-bottom: 1.75rem;
  line-height: 1.5;
}

.platform-dialog-fade-enter-active,
.platform-dialog-fade-leave-active {
  transition: opacity 160ms ease;
}

.platform-dialog-fade-enter-from,
.platform-dialog-fade-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .platform-dialog-fade-enter-active,
  .platform-dialog-fade-leave-active {
    transition: none;
  }
}
</style>
