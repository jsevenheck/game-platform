import { onBeforeUnmount, watch, type Ref } from 'vue';

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export interface ModalDialogOptions {
  /** Called on Escape. Omit for dialogs that must not be dismissed (e.g. game over). */
  onEscape?: () => void;
}

/**
 * Keyboard and focus behaviour for a modal dialog (WCAG 2.4.3 / 2.1.2).
 *
 * Bind `dialogRef` to the element carrying `role="dialog"` and
 * `aria-modal="true"`. Whenever that element appears (e.g. behind a `v-if`),
 * focus moves into it (to a `[data-autofocus]` child if present — use it to
 * start destructive confirmations on the safe choice); Tab and Shift+Tab stay inside; Escape calls
 * `onEscape` when given; and when it disappears focus returns to the element
 * that had it before, so keyboard and screen-reader users never end up behind
 * the overlay.
 */
export function useModalDialog(
  dialogRef: Ref<HTMLElement | null>,
  options: ModalDialogOptions = {}
): void {
  let previouslyFocused: HTMLElement | null = null;
  let active: HTMLElement | null = null;

  function focusableIn(el: HTMLElement): HTMLElement[] {
    return Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
      (candidate) => candidate.getClientRects().length > 0
    );
  }

  function onKeydown(event: KeyboardEvent): void {
    if (!active) return;
    if (event.key === 'Escape' && options.onEscape) {
      event.preventDefault();
      options.onEscape();
      return;
    }
    if (event.key !== 'Tab') return;

    const items = focusableIn(active);
    if (items.length === 0) {
      event.preventDefault();
      active.focus();
      return;
    }
    const first = items[0]!;
    const last = items[items.length - 1]!;
    const current = document.activeElement;
    if (event.shiftKey && (current === first || !active.contains(current))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (current === last || !active.contains(current))) {
      event.preventDefault();
      first.focus();
    }
  }

  function activate(el: HTMLElement): void {
    active = el;
    previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
    (el.querySelector<HTMLElement>('[data-autofocus]') ?? focusableIn(el)[0] ?? el).focus();
    document.addEventListener('keydown', onKeydown);
  }

  function deactivate(): void {
    if (!active) return;
    active = null;
    document.removeEventListener('keydown', onKeydown);
    if (previouslyFocused?.isConnected) previouslyFocused.focus();
    previouslyFocused = null;
  }

  watch(
    dialogRef,
    (el) => {
      if (el && el !== active) {
        deactivate();
        activate(el);
      } else if (!el) {
        deactivate();
      }
    },
    { flush: 'post' }
  );

  onBeforeUnmount(deactivate);
}
