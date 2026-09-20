import { WORD_LIST_DE } from './words.de';
import { WORD_LIST_EN } from './words.en';

export type WordListLocale = 'en' | 'de';

/** Board words for a match, in the match's content language. */
export function getWordList(locale: WordListLocale): readonly string[] {
  return locale === 'de' ? WORD_LIST_DE : WORD_LIST_EN;
}
