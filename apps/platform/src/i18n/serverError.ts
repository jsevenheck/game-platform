import { i18n } from './index';

const NUMBER = /\d+(?:\.\d+)?/g;
/** Trailing phase name of "Cannot … in phase <phase>" messages. */
const PHASE_SUFFIX = /(\bin phase )(\S+)$/;

function slugify(message: string): string {
  return message
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/** `"Only the host can start"` → `only_the_host_can_start` (key under `errors.*`). */
export function errorSlug(message: string): string {
  return slugify(message);
}

/**
 * Same as {@link errorSlug} but every number becomes `n`, so parametrised
 * messages share one key: `"Too many players (max 8)"` → `too_many_players_max_n`.
 * A trailing `in phase <phase>` becomes `in_phase_x` (the phase name is passed as the last value).
 * The extracted numbers are passed to the message as list values (`{0}`, `{1}`).
 */
function templateSlug(message: string): { slug: string; values: string[] } {
  const phase = PHASE_SUFFIX.exec(message);
  const base = phase ? message.replace(PHASE_SUFFIX, '$1x') : message;
  const values = [...(base.match(NUMBER) ?? []), ...(phase ? [phase[2]] : [])];
  return { slug: slugify(base.replace(NUMBER, 'n')), values };
}

/**
 * Translate an error message sent by the server.
 *
 * Servers answer with stable English sentences. Known sentences are looked up
 * under `<gameId>.errors.<slug>` (game-specific) and `errors.<slug>`
 * (platform-wide); messages containing numbers fall back to a number-agnostic
 * key whose text receives the numbers as `{0}`, `{1}`. Anything unknown is
 * shown unchanged so no message is lost.
 * Reads the reactive locale, so it can be used directly in templates/computeds.
 */
export function localizeError(message: string | null | undefined, gameId?: string): string {
  if (!message) return '';
  const { t, te } = i18n.global;
  const scopes = gameId ? [`${gameId}.errors`, 'errors'] : ['errors'];

  const exact = errorSlug(message);
  if (exact) {
    for (const scope of scopes) {
      if (te(`${scope}.${exact}`)) return t(`${scope}.${exact}`);
    }
  }

  const { slug, values } = templateSlug(message);
  if (slug && values.length > 0) {
    for (const scope of scopes) {
      if (te(`${scope}.${slug}`)) return t(`${scope}.${slug}`, values);
    }
  }
  return message;
}
