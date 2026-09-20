import * as fs from 'node:fs';
import * as path from 'node:path';
import { createComponentLogger } from '../../../../../apps/platform/server/logging/logger';
import { DEFAULT_TOPICS } from '../../../core/src/constants';
import type { Topic } from '../../../core/src/types';

const topicLogger = createComponentLogger('kritzelagent-topic-library');
type TopicLocale = 'en' | 'de';

function topicsFile(locale: TopicLocale): string {
  return path.resolve(__dirname, `../../data/topics.${locale}.csv`);
}

type FileReader = (filePath: string, encoding: 'utf8') => string;
let fileReader: FileReader = (filePath, encoding) => fs.readFileSync(filePath, encoding);
const cache = new Map<TopicLocale, Topic[]>();

function parseCsvFields(line: string): string[] | null {
  const fields: string[] = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index]!;
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === ',' && !quoted) {
      fields.push(field.trim());
      field = '';
    } else {
      field += character;
    }
  }

  if (quoted) return null;
  fields.push(field.trim());
  return fields;
}

function loadFromFile(locale: TopicLocale): Topic[] {
  const file = topicsFile(locale);
  let raw: string;
  try {
    raw = fileReader(file, 'utf8');
  } catch (error) {
    topicLogger.warn({ err: error, path: file }, 'topics csv unavailable — using defaults');
    return [...DEFAULT_TOPICS];
  }

  const result: Topic[] = [];
  for (const [index, rawLine] of raw.split(/\r?\n/).entries()) {
    const line = rawLine.replace(/^\uFEFF/, '').trim();
    if (!line || line.startsWith('#')) continue;
    const fields = parseCsvFields(line);
    if (!fields || (index === 0 && fields[0]?.toLowerCase() === 'category')) continue;
    const category = fields?.[0] ?? '';
    const topic = fields?.[1] ?? '';
    if (!category || !topic) {
      topicLogger.warn({ line: index + 1 }, 'invalid topic row — skipped');
      continue;
    }
    result.push({
      id: `t-${String(result.length + 1).padStart(3, '0')}`,
      category,
      topic,
    });
  }

  if (result.length === 0) {
    topicLogger.warn({ path: file }, 'topics csv produced no valid rows — using defaults');
    return [...DEFAULT_TOPICS];
  }
  return result;
}

export function getTopicLibrary(locale: TopicLocale = 'en'): Topic[] {
  let topics = cache.get(locale);
  if (!topics) {
    topics = loadFromFile(locale);
    cache.set(locale, topics);
  }
  return topics.map((topic) => ({ ...topic }));
}

export function pickRandomTopics(count: number, locale: TopicLocale = 'en'): Topic[] {
  const pool = getTopicLibrary(locale);
  if (count <= 0) return [];
  for (let index = pool.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [pool[index], pool[swapIndex]] = [pool[swapIndex]!, pool[index]!];
  }
  return pool.slice(0, count).map((topic) => ({ ...topic }));
}

export function normalizeTopicGuess(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase('de-DE')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
}

export function topicMatchesGuess(topic: string, guess: string): boolean {
  return normalizeTopicGuess(topic) === normalizeTopicGuess(guess);
}

export function __resetTopicLibraryCacheForTests(): void {
  cache.clear();
}

export function __setTopicFileReaderForTests(reader: FileReader): void {
  fileReader = reader;
  cache.clear();
}

export function __resetTopicFileReaderForTests(): void {
  fileReader = (filePath, encoding) => fs.readFileSync(filePath, encoding);
  cache.clear();
}
