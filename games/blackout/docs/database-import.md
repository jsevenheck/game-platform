# Database Import (CSV)

This project includes a CSV import script for extending database data.

## Command

Run from repository root:

```bash
node games/blackout/scripts/import-db-csv.mjs --table <categories|tasks|default_excluded_letters> --file <path-to-csv>
```

Examples:

```bash
node games/blackout/scripts/import-db-csv.mjs --table categories --file games/blackout/server/src/db/data/categories.csv
node games/blackout/scripts/import-db-csv.mjs --table tasks --file games/blackout/server/src/db/data/tasks.csv
node games/blackout/scripts/import-db-csv.mjs --table default_excluded_letters --file games/blackout/server/src/db/data/default_excluded_letters.csv
```

## Supported Tables and CSV Formats

### `categories`

Required headers:

- `name_en`
- `name_de`

Example:

```csv
name_en,name_de
An animal,Ein Tier
A city,Eine Stadt
```

### `tasks`

Required headers:

- `text_en`
- `text_de`

Optional header:

- `requires_letter` (`1/0`, `true/false`, `yes/no`, `ja/nein`)

Example:

```csv
text_en,text_de,requires_letter
Starts with letter {letter},Beginnt mit dem Buchstaben {letter},1
Has exactly two syllables,Hat genau zwei Silben,0
```

### `default_excluded_letters`

Required header:

- `letter`

Example:

```csv
letter
Q
X
Y
```

## Notes

- The parser accepts both `,` and `;` delimiters.
- Inserts use `INSERT OR IGNORE`, so duplicates are skipped.
- The script initializes the DB schema automatically if needed.
- On normal server startup, empty tables are auto-filled from `server/src/db/data/*.csv`.
- Default DB path is `games/blackout/server/src/db/blackout.sqlite`.
- You can override DB path using `DB_PATH`.

PowerShell example:

```powershell
$env:DB_PATH = 'games/blackout/server/src/db/blackout.sqlite'
node games/blackout/scripts/import-db-csv.mjs --table categories --file games/blackout/server/src/db/data/categories.csv
```
