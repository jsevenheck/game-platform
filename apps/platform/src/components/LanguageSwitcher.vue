<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { getCurrentLocale, setLocale, SUPPORTED_LOCALES, type SupportedLocale } from '../i18n';

const { t, locale } = useI18n();

const current = computed<SupportedLocale>(() => {
  void locale.value; // re-evaluate when the locale changes
  return getCurrentLocale();
});

function label(code: SupportedLocale): string {
  return t(code === 'en' ? 'language.english' : 'language.german');
}
</script>

<template>
  <div class="language-switcher" role="group" :aria-label="t('language.label')">
    <button
      v-for="code in SUPPORTED_LOCALES"
      :key="code"
      type="button"
      class="language-switcher-btn"
      :class="{ 'language-switcher-btn--active': code === current }"
      :aria-pressed="code === current ? 'true' : 'false'"
      :lang="code"
      :title="label(code)"
      :data-testid="`language-${code}`"
      @click="setLocale(code)"
    >
      {{ code.toUpperCase() }}
    </button>
  </div>
</template>

<style scoped>
.language-switcher {
  display: inline-flex;
  padding: 2px;
  gap: 2px;
  background: var(--color-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-pill);
}

.language-switcher-btn {
  min-width: 2.25rem;
  min-height: 1.75rem;
  padding: 0 0.5rem;
  border: none;
  border-radius: var(--radius-pill);
  background: transparent;
  color: var(--color-muted);
  font: inherit;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  cursor: pointer;
  transition:
    background 150ms ease,
    color 150ms ease;
}

/* Touch devices: 44px minimum target size. */
@media (pointer: coarse) {
  .language-switcher-btn {
    min-width: 2.75rem;
    min-height: 2.75rem;
  }
}

.language-switcher-btn:hover {
  color: var(--color-foreground);
}

.language-switcher-btn--active {
  background: var(--color-accent);
  color: var(--color-canvas);
}

.language-switcher-btn:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}
</style>
