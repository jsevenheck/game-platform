# CSV Seed Data

These CSV files are the default content source for the SQLite database.
When the server starts and tables are empty, data is loaded from this folder.

These files can be imported from the workspace root with:

```bash
node games/blackout/scripts/import-db-csv.mjs --table categories --file games/blackout/server/src/db/data/categories.csv
node games/blackout/scripts/import-db-csv.mjs --table tasks --file games/blackout/server/src/db/data/tasks.csv
node games/blackout/scripts/import-db-csv.mjs --table default_excluded_letters --file games/blackout/server/src/db/data/default_excluded_letters.csv
```
