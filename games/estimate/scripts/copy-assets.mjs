import { cpSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const gameDir = path.resolve(scriptDir, '..');
const workspaceRoot = path.resolve(gameDir, '..', '..');
const sourceDir = path.join(gameDir, 'server', 'data');
const files = ['questions.en.csv', 'questions.de.csv'];
const targetDir = path.join(
  workspaceRoot,
  'apps',
  'platform',
  'dist',
  'server',
  'games',
  'estimate',
  'server',
  'data'
);

mkdirSync(targetDir, { recursive: true });
for (const file of files) {
  const sourceFile = path.join(sourceDir, file);
  if (!existsSync(sourceFile)) {
    console.error(`[copy-estimate-assets] Source file not found: ${sourceFile}`);
    process.exit(1);
  }
  cpSync(sourceFile, path.join(targetDir, file));
}
console.log(`[copy-estimate-assets] Copied ${files.join(', ')} to ${targetDir}`);
