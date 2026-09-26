import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';

describe('blackout database seeding', () => {
  let dir: string;
  const originalDbPath = process.env.DB_PATH;

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'blackout-db-'));
    vi.resetModules();
  });

  afterEach(() => {
    if (originalDbPath === undefined) delete process.env.DB_PATH;
    else process.env.DB_PATH = originalDbPath;
    rmSync(dir, { recursive: true, force: true });
  });

  it('replaces content left in an existing database with the current CSVs', async () => {
    const dbPath = path.join(dir, 'blackout.sqlite');
    process.env.DB_PATH = dbPath;

    const first = (await import('../server/src/db/database')).default;
    const seededCategories = (
      first.prepare('SELECT COUNT(*) AS n FROM categories').get() as { n: number }
    ).n;
    expect(seededCategories).toBeGreaterThan(0);
    first.prepare("INSERT INTO categories (name_en, name_de) VALUES ('Stale', 'Veraltet')").run();
    first.close();

    vi.resetModules();
    const second = (await import('../server/src/db/database')).default;
    const stale = second
      .prepare("SELECT COUNT(*) AS n FROM categories WHERE name_en = 'Stale'")
      .get() as {
      n: number;
    };
    const categories = (
      second.prepare('SELECT COUNT(*) AS n FROM categories').get() as { n: number }
    ).n;
    second.close();

    expect(stale.n).toBe(0);
    expect(categories).toBe(seededCategories);
  });
});
