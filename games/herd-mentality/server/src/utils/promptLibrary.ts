import * as fs from 'fs';
import * as path from 'path';
import { createComponentLogger } from '../../../../../apps/platform/server/logging/logger';
import { DEFAULT_PROMPTS } from '../../../core/src/constants';
import type { Prompt } from '../../../core/src/types';

const logger = createComponentLogger('herd-mentality-prompt-library');
const PROMPTS_FILE = path.resolve(__dirname, '../../data/prompts.csv');
let fileReader: (filePath: string, encoding: 'utf8') => string = (filePath, encoding) =>
  fs.readFileSync(filePath, encoding);
let cache: Prompt[] | null = null;

function parseLine(line: string): string | null {
  const value = line.replace(/^\uFEFF/, '').trim();
  if (!value || value.startsWith('#')) return null;
  const match = value.match(/^"((?:[^"]|"")*)"$/);
  return (match?.[1] ?? value).replace(/""/g, '"').trim() || null;
}

function loadPrompts(): Prompt[] {
  let raw: string;
  try {
    raw = fileReader(PROMPTS_FILE, 'utf8');
  } catch (error) {
    logger.warn({ error, path: PROMPTS_FILE }, 'prompts.csv unavailable; using built-in prompts');
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
    logger.warn({ path: PROMPTS_FILE }, 'prompts.csv had no valid rows; using built-in prompts');
    return [...DEFAULT_PROMPTS];
  }
  return prompts;
}

export function getPromptLibrary(): Prompt[] {
  if (!cache) cache = loadPrompts();
  return cache.map((prompt) => ({ ...prompt }));
}

export function pickRandomPrompts(count: number): Prompt[] {
  const pool = getPromptLibrary();
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j]!, pool[i]!];
  }
  return pool.slice(0, Math.max(0, count)).map((prompt) => ({ ...prompt }));
}

export function __resetPromptLibraryCacheForTests(): void {
  cache = null;
}

export function __setPromptFileReaderForTests(
  reader?: (filePath: string, encoding: 'utf8') => string
): void {
  fileReader = reader ?? ((filePath, encoding) => fs.readFileSync(filePath, encoding));
  cache = null;
}
