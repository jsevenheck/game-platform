import db from '../db/database';
import type { Category, Language, TaskRule } from '../../../core/src/types';
import { DEFAULT_EXCLUDED_LETTERS } from '../../../core/src/constants';

const getCategoriesByLanguage = db.prepare(
  `
    SELECT
      id,
      CASE WHEN ? = 'de' THEN name_de ELSE name_en END AS name
    FROM categories
  `
);

const getTasksByLanguage = db.prepare(
  `
    SELECT
      id,
      CASE WHEN ? = 'de' THEN text_de ELSE text_en END AS text,
      requires_letter AS requiresLetter
    FROM tasks
  `
);

const getDefaultExcludedLettersStmt = db.prepare(
  'SELECT letter FROM default_excluded_letters ORDER BY letter ASC'
);

export function getDefaultExcludedLetters(): string[] {
  const rows = getDefaultExcludedLettersStmt.all() as { letter: string }[];
  if (rows.length === 0) {
    return [...DEFAULT_EXCLUDED_LETTERS];
  }

  const unique = new Set<string>();
  for (const row of rows) {
    const normalized = (row.letter || '').trim().toUpperCase();
    if (/^[A-Z]$/.test(normalized)) {
      unique.add(normalized);
    }
  }

  if (unique.size === 0) {
    return [...DEFAULT_EXCLUDED_LETTERS];
  }

  return Array.from(unique);
}

function getAvailableLetters(excludedLetters: string[]): string[] {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  const excluded = new Set(
    excludedLetters
      .map((letter) => letter.trim().toUpperCase())
      .filter((letter) => /^[A-Z]$/.test(letter))
  );

  const available = alphabet.filter((letter) => !excluded.has(letter));
  return available.length > 0 ? available : alphabet;
}

function randomItem<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)]!;
}

export function getUnusedPrompt(
  usedPairs: Set<string>,
  language: Language,
  excludedLetters: string[]
): { category: Category; task: TaskRule; letter: string | null } {
  const categories = getCategoriesByLanguage.all(language) as Category[];
  const tasksRaw = getTasksByLanguage.all(language) as Array<{
    id: number;
    text: string;
    requiresLetter: number;
  }>;
  const tasks: TaskRule[] = tasksRaw.map((task) => ({
    id: task.id,
    text: task.text,
    requiresLetter: !!task.requiresLetter,
  }));

  if (categories.length === 0) {
    throw new Error(`No categories found for language "${language}"`);
  }
  if (tasks.length === 0) {
    throw new Error(`No tasks found for language "${language}"`);
  }

  const availableLetters = getAvailableLetters(excludedLetters);
  const maxAttempts = categories.length * tasks.length * Math.max(availableLetters.length, 1);

  for (let i = 0; i < maxAttempts; i++) {
    const category = randomItem(categories);
    const task = randomItem(tasks);
    const letter = task.requiresLetter ? randomItem(availableLetters) : null;
    const key = `${category.id}:${task.id}:${letter ?? '-'}`;
    if (!usedPairs.has(key)) {
      return { category, task, letter };
    }
  }

  const fallbackCategory = randomItem(categories);
  const fallbackTask = randomItem(tasks);
  const fallbackLetter = fallbackTask.requiresLetter ? randomItem(availableLetters) : null;
  return { category: fallbackCategory, task: fallbackTask, letter: fallbackLetter };
}
