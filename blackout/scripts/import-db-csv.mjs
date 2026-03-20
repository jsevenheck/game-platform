#!/usr/bin/env node
import Database from 'better-sqlite3';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      args[key] = 'true';
    } else {
      args[key] = next;
      i += 1;
    }
  }
  return args;
}

function parseCsv(text, delimiter) {
  const rows = [];
  let row = [];
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

function toBooleanNumber(value) {
  const normalized = String(value).trim().toLowerCase();
  return ['1', 'true', 'yes', 'y', 'ja'].includes(normalized) ? 1 : 0;
}

function normalizeLetter(value) {
  const letter = String(value).trim().toUpperCase();
  if (!/^[A-Z]$/.test(letter)) return null;
  return letter;
}

const args = parseArgs(process.argv.slice(2));
const table = args.table;
const file = args.file;

if (!table || !file) {
  console.error(
    'Usage: node scripts/import-db-csv.mjs --table <categories|tasks|default_excluded_letters> --file <path-to-csv>'
  );
  process.exit(1);
}

const csvPath = path.isAbsolute(file) ? file : path.join(process.cwd(), file);
if (!existsSync(csvPath)) {
  console.error(`CSV file not found: ${csvPath}`);
  process.exit(1);
}

const configuredDbPath = process.env.DB_PATH || path.join('server', 'src', 'db', 'blackout.sqlite');
const dbPath = path.isAbsolute(configuredDbPath)
  ? configuredDbPath
  : path.join(process.cwd(), configuredDbPath);
mkdirSync(path.dirname(dbPath), { recursive: true });

const raw = readFileSync(csvPath, 'utf-8').replace(/^\uFEFF/, '');
const firstLine = raw.split(/\r?\n/, 1)[0] ?? '';
const delimiter = firstLine.includes(';') && !firstLine.includes(',') ? ';' : ',';
const rows = parseCsv(raw, delimiter);

if (rows.length < 2) {
  console.error('CSV must contain a header row and at least one data row.');
  process.exit(1);
}

const headers = rows[0].map((header) => header.trim());
const dataRows = rows.slice(1).map((cells) => {
  const entry = {};
  for (let i = 0; i < headers.length; i++) {
    entry[headers[i]] = (cells[i] ?? '').trim();
  }
  return entry;
});

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function readSqlFromProject(fileName) {
  const candidates = [
    path.join(process.cwd(), 'server', 'src', 'db', fileName),
    path.join(process.cwd(), 'dist', 'standalone-server', 'server', 'src', 'db', fileName),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return readFileSync(candidate, 'utf-8');
    }
  }

  throw new Error(`Could not find ${fileName}. Looked in: ${candidates.join(', ')}`);
}

// Ensure schema/tables exist.
const schemaSql = readSqlFromProject('schema.sql');
db.exec(schemaSql);

if (table === 'categories') {
  if (!headers.includes('name_en') || !headers.includes('name_de')) {
    console.error('Categories CSV must contain headers: name_en,name_de');
    process.exit(1);
  }
  const insert = db.prepare(
    'INSERT OR IGNORE INTO categories (name_en, name_de) VALUES (@name_en, @name_de)'
  );
  const tx = db.transaction((rowsToInsert) => {
    for (const row of rowsToInsert) {
      if (!row.name_en || !row.name_de) continue;
      insert.run(row);
    }
  });
  tx(dataRows);
} else if (table === 'tasks') {
  if (!headers.includes('text_en') || !headers.includes('text_de')) {
    console.error('Tasks CSV must contain headers: text_en,text_de,requires_letter(optional)');
    process.exit(1);
  }
  const insert = db.prepare(
    `
      INSERT OR IGNORE INTO tasks (text_en, text_de, requires_letter)
      VALUES (@text_en, @text_de, @requires_letter)
    `
  );
  const tx = db.transaction((rowsToInsert) => {
    for (const row of rowsToInsert) {
      if (!row.text_en || !row.text_de) continue;
      insert.run({
        text_en: row.text_en,
        text_de: row.text_de,
        requires_letter: toBooleanNumber(row.requires_letter ?? '1'),
      });
    }
  });
  tx(dataRows);
} else if (table === 'default_excluded_letters') {
  if (!headers.includes('letter')) {
    console.error('Default excluded letters CSV must contain header: letter');
    process.exit(1);
  }
  const insert = db.prepare('INSERT OR IGNORE INTO default_excluded_letters (letter) VALUES (?)');
  const tx = db.transaction((rowsToInsert) => {
    for (const row of rowsToInsert) {
      const letter = normalizeLetter(row.letter);
      if (!letter) continue;
      insert.run(letter);
    }
  });
  tx(dataRows);
} else {
  console.error(`Unsupported table "${table}". Use one of: categories, tasks, default_excluded_letters`);
  process.exit(1);
}

console.log(`Imported ${dataRows.length} row(s) into ${table} from ${csvPath}`);
