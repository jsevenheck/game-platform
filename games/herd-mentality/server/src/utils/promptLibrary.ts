import * as fs from 'fs';
import * as path from 'path';
import { createComponentLogger } from '../../../../../apps/platform/server/logging/logger';
import { DEFAULT_PROMPTS } from '../../../core/src/constants';
import type { Prompt } from '../../../core/src/types';

const logger = createComponentLogger('herd-mentality-prompt-library');
type PromptLocale = 'en' | 'de';

function promptsFile(locale: PromptLocale): string {
  return path.resolve(__dirname, `../../data/prompts.${locale}.csv`);
}
let fileReader: (filePath: string, encoding: 'utf8') => string = (filePath, encoding) =>
  fs.readFileSync(filePath, encoding);
const cache = new Map<PromptLocale, Prompt[]>();

function parseLine(line: string): string | null {
  const value = line.replace(/^\uFEFF/, '').trim();
  if (!value || value.startsWith('#')) return null;
  const match = value.match(/^"((?:[^"]|"")*)"$/);
  return (match?.[1] ?? value).replace(/""/g, '"').trim() || null;
}

function loadPrompts(locale: PromptLocale): Prompt[] {
  const file = promptsFile(locale);
  let raw: string;
  try {
    raw = fileReader(file, 'utf8');
  } catch (error) {
    logger.warn({ error, path: file }, 'prompts csv unavailable; using built-in prompts');
    return [...DEFAULT_PROMPTS];
  }
  const prompts: Prompt[] = [];
  for (const [index, line] of raw.split(/\r?\n/u).entries()) {
    const text = parseLine(line);
    if (!text || (index === 0 && text.toLocaleLowerCase('und') === 'prompt')) continue;
    if (text.length > 240) {
      logger.warn({ line: index + 1 }, 'prompt is too long; skipped');
      continue;
    }
    prompts.push({ id: `p-${String(index).padStart(3, '0')}`, text });
  }
  if (prompts.length === 0) {
    logger.warn({ path: file }, 'prompts csv had no valid rows; using built-in prompts');
    return [...DEFAULT_PROMPTS];
  }
  return prompts;
}

export function getPromptLibrary(locale: PromptLocale = 'en'): Prompt[] {
  let prompts = cache.get(locale);
  if (!prompts) {
    prompts = loadPrompts(locale);
    cache.set(locale, prompts);
  }
  return prompts.map((prompt) => ({ ...prompt }));
}

export function pickRandomPrompts(count: number, locale: PromptLocale = 'en'): Prompt[] {
  const pool = getPromptLibrary(locale);
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j]!, pool[i]!];
  }
  return pool.slice(0, Math.max(0, count)).map((prompt) => ({ ...prompt }));
}

export function __resetPromptLibraryCacheForTests(): void {
  cache.clear();
}

export function __setPromptFileReaderForTests(
  reader?: (filePath: string, encoding: 'utf8') => string
): void {
  fileReader = reader ?? ((filePath, encoding) => fs.readFileSync(filePath, encoding));
  cache.clear();
}
