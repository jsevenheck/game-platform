# Database Import (CSV)

This project includes a CSV import script for extending database data.

## Command

Run from repository root:

```bash
pnpm db:import:csv -- --table <categories|tasks|default_excluded_letters> --file <path-to-csv>
```

Examples:

```bash
pnpm db:import:csv -- --table categories --file server/src/db/data/categories.csv
pnpm db:import:csv -- --table tasks --file server/src/db/data/tasks.csv
pnpm db:import:csv -- --table default_excluded_letters --file server/src/db/data/default_excluded_letters.csv
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
- Default DB path is `server/src/db/blackout.sqlite`.
- You can override DB path using `DB_PATH`.

PowerShell example:

```powershell
$env:DB_PATH = 'server/src/db/blackout.sqlite'
pnpm db:import:csv -- --table categories --file .\server\src\db\data\categories.csv
```
