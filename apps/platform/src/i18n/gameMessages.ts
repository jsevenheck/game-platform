import { i18n } from './index';

type MessageTree = Record<string, unknown>;

const registered = new Set<string>();

/**
 * Register a game's UI messages under its own namespace (`t('flip7.title')`).
 *
 * Games call this once from their own `i18n` module; it is idempotent, so a
 * game can be mounted repeatedly (replay, reload) without re-merging.
 */
export function registerGameMessages(
  gameId: string,
  messages: { en: MessageTree; de: MessageTree }
): void {
  if (registered.has(gameId)) return;
  registered.add(gameId);
  i18n.global.mergeLocaleMessage('en', { [gameId]: messages.en });
  i18n.global.mergeLocaleMessage('de', { [gameId]: messages.de });
}
