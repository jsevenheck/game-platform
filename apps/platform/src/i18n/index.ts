import { createI18n } from 'vue-i18n';
import { de } from './messages/de';
import { en } from './messages/en';
import {
  DEFAULT_LOCALE,
  LOCALE_STORAGE_KEY,
  SUPPORTED_LOCALES,
  type SupportedLocale,
} from './types';

export { SUPPORTED_LOCALES, type SupportedLocale };

function isSupportedLocale(locale: string): locale is SupportedLocale {
  return SUPPORTED_LOCALES.includes(locale as SupportedLocale);
}

export function normalizeLocale(locale: string | null | undefined): SupportedLocale | null {
  if (typeof locale !== 'string') return null;
  const normalized = locale.trim().replace(/_/g, '-').toLowerCase();
  if (!normalized) return null;
  if (isSupportedLocale(normalized)) return normalized;
  const [language] = normalized.split('-');
  return isSupportedLocale(language) ? language : null;
}

function readStoredLocale(): SupportedLocale | null {
  if (typeof window === 'undefined') return null;
  try {
    return normalizeLocale(window.localStorage.getItem(LOCALE_STORAGE_KEY));
  } catch {
    return null;
  }
}

function writeStoredLocale(locale: SupportedLocale): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // Storage can be blocked (private mode); the locale still applies in memory.
  }
}

function getBrowserLocale(): SupportedLocale | null {
  if (typeof window === 'undefined') return null;
  const { navigator } = window;
  const preferred = navigator.languages?.length ? navigator.languages : [navigator.language];
  for (const candidate of preferred) {
    const normalized = normalizeLocale(candidate);
    if (normalized) return normalized;
  }
  return null;
}

function getInitialLocale(): SupportedLocale {
  return readStoredLocale() ?? getBrowserLocale() ?? DEFAULT_LOCALE;
}

export const messages = { en, de };

export const i18n = createI18n({
  legacy: false,
  locale: getInitialLocale(),
  fallbackLocale: DEFAULT_LOCALE,
  messages,
});

function applyLocale(locale: SupportedLocale): void {
  i18n.global.locale.value = locale;
  if (typeof document !== 'undefined') {
    document.documentElement.lang = locale;
  }
}

/** Change the UI language and remember it for the next visit. */
export function setLocale(locale: string | null | undefined): void {
  const next = normalizeLocale(locale) ?? DEFAULT_LOCALE;
  applyLocale(next);
  writeStoredLocale(next);
}

export function getCurrentLocale(): SupportedLocale {
  return normalizeLocale(i18n.global.locale.value) ?? DEFAULT_LOCALE;
}

applyLocale(getInitialLocale());
