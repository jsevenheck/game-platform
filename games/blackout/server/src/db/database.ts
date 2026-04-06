import Database, { type Database as DatabaseType } from 'better-sqlite3';
import { existsSync, mkdirSync, readFileSync } from 'fs';
import path from 'path';
import { createComponentLogger } from '../../../../../apps/platform/server/logging/logger';

const dbLogger = createComponentLogger('blackout-db');

function resolveDefaultDbPath(): string {
  const candidates = [
    path.join(__dirname, 'blackout.sqlite'),
    path.join('server', 'src', 'db', 'blackout.sqlite'),
    path.join('games', 'blackout', 'server', 'src', 'db', 'blackout.sqlite'),
  ];

  for (const candidate of candidates) {
    const absolute = path.join(process.cwd(), candidate);
    if (existsSync(path.dirname(absolute))) {
      return candidate;
    }
  }

  return candidates[0] ?? '';
}

const configuredDbPath = process.env.DB_PATH || resolveDefaultDbPath();
const dbPath = path.isAbsolute(configuredDbPath)
  ? configuredDbPath
  : path.join(process.cwd(), configuredDbPath);

mkdirSync(path.dirname(dbPath), { recursive: true });

const db: DatabaseType = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function readSqlFile(fileName: 'schema.sql'): string {
  const candidates = [
    path.join(__dirname, fileName),
    path.join(__dirname, '..', 'src', 'db', fileName),
    path.join(process.cwd(), 'server', 'src', 'db', fileName),
    path.join(process.cwd(), 'games', 'blackout', 'server', 'src', 'db', fileName),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return readFileSync(candidate, 'utf-8');
    }
  }

  throw new Error(`Could not find ${fileName}. Looked in: ${candidates.join(', ')}`);
}

const schemaSQL = readSqlFile('schema.sql');

function parseCsv(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        value += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && char === delimiter) {
      row.push(value);
      value = '';
      continue;
    }

    if (!inQuotes && (char === '\n' || char === '\r')) {
      if (char === '\r' && next === '\n') i += 1;
      row.push(value);
      value = '';
      if (row.some((cell) => cell.trim() !== '')) {
        rows.push(row);
      }
      row = [];
      continue;
    }

    value += char;
  }

  if (value.length > 0 || row.length > 0) {
    row.push(value);
    if (row.some((cell) => cell.trim() !== '')) {
      rows.push(row);
    }
  }

  return rows;
}

function readCsvRows(fileName: string): Record<string, string>[] {
  const candidates = [
    path.join(__dirname, 'data', fileName),
    path.join(__dirname, '..', 'src', 'db', 'data', fileName),
    path.join(process.cwd(), 'server', 'src', 'db', 'data', fileName),
    path.join(process.cwd(), 'games', 'blackout', 'server', 'src', 'db', 'data', fileName),
  ];

  let csvContent: string | null = null;
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      csvContent = readFileSync(candidate, 'utf-8');
      break;
    }
  }

  if (!csvContent) {
    throw new Error(
      `Could not find CSV seed file "${fileName}". Looked in: ${candidates.join(', ')}`
    );
  }

  const raw = csvContent.replace(/^\uFEFF/, '');
  const firstLine = raw.split(/\r?\n/, 1)[0] ?? '';
  const delimiter = firstLine.includes(';') && !firstLine.includes(',') ? ';' : ',';
  const parsedRows = parseCsv(raw, delimiter);
  if (parsedRows.length < 2) {
    return [];
  }

  const firstRow = parsedRows[0];
  const headers = firstRow ? firstRow.map((header) => header.trim()) : [];
  return parsedRows.slice(1).map((cells) => {
    const entry: Record<string, string> = {};
    for (let i = 0; i < headers.length; i++) {
      const header = headers[i];
      if (header) {
        entry[header] = (cells[i] ?? '').trim();
      }
    }
    return entry;
  });
}

function toBooleanNumber(value: string): number {
  const normalized = String(value).trim().toLowerCase();
  return ['1', 'true', 'yes', 'y', 'ja'].includes(normalized) ? 1 : 0;
}

function normalizeLetter(value: string): string | null {
  const letter = String(value).trim().toUpperCase();
  if (!/^[A-Z]$/.test(letter)) return null;
  return letter;
}

function seedDefaultsFromCsv(shouldSeed: {
  categories: boolean;
  tasks: boolean;
  letters: boolean;
}): void {
  if (shouldSeed.categories) {
    const categoryRows = readCsvRows('categories.csv');
    const insertCategory = db.prepare(
      'INSERT OR IGNORE INTO categories (name_en, name_de) VALUES (@name_en, @name_de)'
    );
    const tx = db.transaction((rows: Record<string, string>[]) => {
      for (const row of rows) {
        if (!row.name_en || !row.name_de) continue;
        insertCategory.run({ name_en: row.name_en, name_de: row.name_de });
      }
    });
    tx(categoryRows);
  }

  if (shouldSeed.tasks) {
    const taskRows = readCsvRows('tasks.csv');
    const insertTask = db.prepare(
      `
        INSERT OR IGNORE INTO tasks (text_en, text_de, requires_letter)
        VALUES (@text_en, @text_de, @requires_letter)
      `
    );
    const tx = db.transaction((rows: Record<string, string>[]) => {
      for (const row of rows) {
        if (!row.text_en || !row.text_de) continue;
        insertTask.run({
          text_en: row.text_en,
          text_de: row.text_de,
          requires_letter: toBooleanNumber(row.requires_letter ?? '1'),
        });
      }
    });
    tx(taskRows);
  }

  if (shouldSeed.letters) {
    const letterRows = readCsvRows('default_excluded_letters.csv');
    const insertLetter = db.prepare(
      'INSERT OR IGNORE INTO default_excluded_letters (letter) VALUES (?)'
    );
    const tx = db.transaction((rows: Record<string, string>[]) => {
      for (const row of rows) {
        const letter = normalizeLetter(row.letter ?? '');
        if (!letter) continue;
        insertLetter.run(letter);
      }
    });
    tx(letterRows);
  }
}

function tableExists(tableName: string): boolean {
  const row = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(tableName) as { name?: string } | undefined;
  return !!row?.name;
}

function hasColumn(tableName: string, columnName: string): boolean {
  if (!tableExists(tableName)) return false;
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>;
  return columns.some((column) => column.name === columnName);
}

function needsSchemaReset(): boolean {
  if (!tableExists('categories')) return true;
  if (!tableExists('tasks')) return true;
  if (!tableExists('default_excluded_letters')) return true;

  const hasLegacyExcludedLetters = tableExists('excluded_letters');
  if (hasLegacyExcludedLetters) return true;

  if (!hasColumn('categories', 'name_en') || !hasColumn('categories', 'name_de')) return true;
  if (!hasColumn('tasks', 'text_en') || !hasColumn('tasks', 'text_de')) return true;

  return false;
}

if (needsSchemaReset()) {
  dbLogger.warn({ dbPath }, 'resetting blackout database schema');
  db.exec(`
    DROP TABLE IF EXISTS categories;
    DROP TABLE IF EXISTS tasks;
    DROP TABLE IF EXISTS excluded_letters;
    DROP TABLE IF EXISTS default_excluded_letters;
  `);
}

db.exec(schemaSQL);

const counts = db
  .prepare(
    `
      SELECT
        (SELECT COUNT(*) FROM categories) AS categoriesCount,
        (SELECT COUNT(*) FROM tasks) AS tasksCount,
        (SELECT COUNT(*) FROM default_excluded_letters) AS lettersCount
    `
  )
  .get() as { categoriesCount: number; tasksCount: number; lettersCount: number };

seedDefaultsFromCsv({
  categories: counts.categoriesCount === 0,
  tasks: counts.tasksCount === 0,
  letters: counts.lettersCount === 0,
});

const finalCounts = db
  .prepare(
    `
      SELECT
        (SELECT COUNT(*) FROM categories) AS categoriesCount,
        (SELECT COUNT(*) FROM tasks) AS tasksCount,
        (SELECT COUNT(*) FROM default_excluded_letters) AS lettersCount
    `
  )
  .get() as { categoriesCount: number; tasksCount: number; lettersCount: number };

dbLogger.info(
  {
    dbPath,
    categoriesCount: finalCounts.categoriesCount,
    tasksCount: finalCounts.tasksCount,
    lettersCount: finalCounts.lettersCount,
  },
  'blackout database ready'
);

export default db;
