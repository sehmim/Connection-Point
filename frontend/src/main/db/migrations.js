const { SCHEMA_SQL } = require('./schema')

const MIGRATIONS = [
  { version: 1, up: (db) => db.exec(SCHEMA_SQL) },
  { version: 2, up: (db) => db.exec(`
    CREATE TABLE IF NOT EXISTS github_repos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT NOT NULL UNIQUE,
      hostname TEXT NOT NULL,
      label TEXT NOT NULL,
      added_at INTEGER NOT NULL
    );
  `) },
  { version: 3, up: (db) => db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_github_items_url ON github_items(url);
  `) },
  { version: 4, up: (db) => db.exec(`
    CREATE TABLE IF NOT EXISTS jira_boards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT NOT NULL UNIQUE,
      hostname TEXT NOT NULL,
      label TEXT NOT NULL,
      added_at INTEGER NOT NULL
    );
  `) },
]

function runMigrations(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL)`)
  let current = db.prepare('SELECT version FROM schema_version LIMIT 1').get()?.version ?? 0
  const pending = MIGRATIONS.filter(m => m.version > current).sort((a, b) => a.version - b.version)
  for (const m of pending) {
    db.transaction(() => {
      m.up(db)
      db.prepare('DELETE FROM schema_version').run()
      db.prepare('INSERT INTO schema_version VALUES (?)').run(m.version)
    })()
    current = m.version
  }
}

module.exports = { runMigrations }
