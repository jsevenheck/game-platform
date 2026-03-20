import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const sourceDir = path.join(rootDir, 'server', 'src', 'db');
const targetDir = path.join(rootDir, 'dist', 'standalone-server', 'server', 'src', 'db');

if (!existsSync(sourceDir)) {
  console.error(`[copy-db-assets] Source directory not found: ${sourceDir}`);
  process.exit(1);
}

mkdirSync(targetDir, { recursive: true });
cpSync(path.join(sourceDir, 'schema.sql'), path.join(targetDir, 'schema.sql'));
cpSync(path.join(sourceDir, 'data'), path.join(targetDir, 'data'), { recursive: true });
const legacySeedPath = path.join(targetDir, 'seed.sql');
if (existsSync(legacySeedPath)) {
  rmSync(legacySeedPath);
}

// Remove the old standalone DB so the server re-seeds from the current CSVs on next start
const standaloneDbPath = path.join(targetDir, 'blackout.sqlite');
for (const ext of ['', '-shm', '-wal']) {
  const f = standaloneDbPath + ext;
  if (existsSync(f)) rmSync(f);
}

console.log(`[copy-db-assets] Copied DB assets to ${targetDir}`);
