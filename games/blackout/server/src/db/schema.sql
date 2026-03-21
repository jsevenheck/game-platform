CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name_en TEXT NOT NULL,
  name_de TEXT NOT NULL,
  UNIQUE (name_en, name_de)
);

CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  text_en TEXT NOT NULL,
  text_de TEXT NOT NULL,
  requires_letter INTEGER NOT NULL DEFAULT 1 CHECK (requires_letter IN (0, 1)),
  UNIQUE (text_en, text_de)
);

CREATE TABLE IF NOT EXISTS default_excluded_letters (
  letter CHAR(1) PRIMARY KEY
);
