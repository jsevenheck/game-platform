import { existsSync, readFileSync } from 'fs';
import { dirname, join, parse, resolve } from 'path';

function stripOptionalQuotes(value: string): string {
  if (value.length < 2) return value;

  const first = value[0];
  const last = value[value.length - 1];
  if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
    return value.slice(1, -1);
  }

  return value;
}

function parseEnvFile(contents: string): Record<string, string> {
  const values: Record<string, string> = {};

  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const equalsIndex = line.indexOf('=');
    if (equalsIndex <= 0) continue;

    const key = line.slice(0, equalsIndex).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;

    const rawValue = line.slice(equalsIndex + 1).trim();
    values[key] = stripOptionalQuotes(rawValue);
  }

  return values;
}

function findNearestEnvFile(startDir = process.cwd()): string | null {
  let current = resolve(startDir);
  const root = parse(current).root;

  while (true) {
    const candidate = join(current, '.env');
    if (existsSync(candidate)) return candidate;
    if (current === root) return null;
    current = dirname(current);
  }
}

export function loadLocalEnvFile(): void {
  const envFilePath = findNearestEnvFile();
  if (!envFilePath) return;

  const values = parseEnvFile(readFileSync(envFilePath, 'utf8'));
  for (const [key, value] of Object.entries(values)) {
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadLocalEnvFile();
