import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { getDb, closeDb } from './connection.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

/**
 * Applies every *.sql file in ./migrations that hasn't run yet, in
 * filename order. Applied migrations are recorded in `schema_migrations`
 * so this is safe to run on every boot (idempotent).
 *
 * @returns {string[]} names of migrations applied in this run
 */
export function runMigrations() {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name       TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);

  const applied = new Set(
    db.prepare('SELECT name FROM schema_migrations').all().map((r) => r.name),
  );

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const record = db.prepare(
    'INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)',
  );

  const justApplied = [];
  for (const file of files) {
    if (applied.has(file)) continue;

    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    // Each migration runs atomically: schema change + bookkeeping together.
    db.transaction(() => {
      db.exec(sql);
      record.run(file, new Date().toISOString());
    })();

    justApplied.push(file);
  }

  return justApplied;
}

// Allow running directly: `npm run migrate`
// (pathToFileURL handles spaces/special chars in the path correctly)
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const applied = runMigrations();
    if (applied.length) {
      console.log(`Applied ${applied.length} migration(s):`);
      applied.forEach((m) => console.log(`  - ${m}`));
    } else {
      console.log('Database is up to date — no migrations to apply.');
    }
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exitCode = 1;
  } finally {
    closeDb();
  }
}
