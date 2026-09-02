import { cpSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const gameDir = path.resolve(scriptDir, '..');
const workspaceRoot = path.resolve(gameDir, '..', '..');
const sourceFile = path.join(gameDir, 'server', 'data', 'prompts.csv');
const targetDir = path.join(
  workspaceRoot,
  'apps',
  'platform',
  'dist',
  'server',
  'games',
  'herd-mentality',
  'server',
  'data'
);

if (!existsSync(sourceFile)) {
  console.error(`[copy-herd-mentality-assets] Source file not found: ${sourceFile}`);
  process.exit(1);
}

mkdirSync(targetDir, { recursive: true });
cpSync(sourceFile, path.join(targetDir, 'prompts.csv'));
console.log(`[copy-herd-mentality-assets] Copied prompts.csv to ${targetDir}`);
