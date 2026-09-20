import { afterEach, describe, expect, it } from 'vitest';
import { setLocale } from '../src/i18n';
import { errorSlug, localizeError } from '../src/i18n/serverError';

afterEach(() => setLocale('en'));

describe('localizeError', () => {
  it('returns an empty string for missing messages', () => {
    expect(localizeError(null)).toBe('');
    expect(localizeError(undefined)).toBe('');
  });

  it('translates exact platform-wide sentences', () => {
    setLocale('de');
    expect(localizeError('Too many requests — slow down')).toBe(
      'Zu viele Anfragen. Bitte etwas langsamer.'
    );
  });

  it('fills numbers into number-agnostic templates', () => {
    setLocale('de');
    expect(localizeError('Need at least 2 connected players to start, have 1')).toBe(
      'Zum Start müssen mindestens 2 Spieler verbunden sein (aktuell 1).'
    );
  });

  it('translates "in phase <phase>" messages regardless of the phase name', () => {
    setLocale('de');
    const reveal = localizeError('Cannot reveal in phase guessing');
    expect(reveal).toBe(localizeError('Cannot reveal in phase voting'));
    expect(reveal).not.toBe('Cannot reveal in phase guessing');
  });

  it('keeps English text under the en locale and shows unknown messages unchanged', () => {
    setLocale('en');
    expect(localizeError('Too many requests — slow down')).toBe(
      'Too many requests. Please slow down.'
    );
    expect(localizeError('Something nobody translated')).toBe('Something nobody translated');
  });

  it('builds stable slugs', () => {
    expect(errorSlug('Only the host can start')).toBe('only_the_host_can_start');
  });
});
