# CSV Seed Data

These CSV files are the default content source for the SQLite database.
When the server starts and tables are empty, data is loaded from this folder.

These files can be imported with:

```bash
pnpm db:import:csv -- --table categories --file server/src/db/data/categories.csv
pnpm db:import:csv -- --table tasks --file server/src/db/data/tasks.csv
pnpm db:import:csv -- --table default_excluded_letters --file server/src/db/data/default_excluded_letters.csv
```
