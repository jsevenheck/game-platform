import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const gameDir = path.resolve(__dirname, '..');
// Workspace root is 2 levels up from games/blackout/
const workspaceRoot = path.resolve(gameDir, '..', '..');

const sourceDir = path.join(gameDir, 'server', 'src', 'db');
// Target: platform's compiled server output alongside the compiled Blackout server code
const targetDir = path.join(
  workspaceRoot,
  'apps',
  'platform',
  'dist',
  'server',
  'games',
  'blackout',
  'server',
  'src',
  'db'
);

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

// Remove old DB so the server re-seeds from the current CSVs on next start
const dbPath = path.join(targetDir, 'blackout.sqlite');
for (const ext of ['', '-shm', '-wal']) {
  const f = dbPath + ext;
  if (existsSync(f)) rmSync(f);
}

console.log(`[copy-db-assets] Copied DB assets to ${targetDir}`);
