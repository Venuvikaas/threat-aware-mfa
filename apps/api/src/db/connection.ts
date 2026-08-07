/**
 * SQLite connection and migration runner (docs/EXECUTION.md Phase 1).
 *
 * - Foreign keys are enabled on every connection (database rule: "SQLite
 *   foreign keys enabled").
 * - WAL journaling keeps the demo robust across dev reloads.
 * - Migrations are explicit SQL files applied in filename order, tracked in
 *   `schema_migrations` so they run exactly once.
 */
import Database from "better-sqlite3";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export type Db = Database.Database;

export function openDatabase(filename: string): Db {
  const db = new Database(filename);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  return db;
}

/**
 * Apply every `*.sql` file in `migrationsDir` that has not been applied yet.
 * Returns the names of migrations applied by this call.
 */
export function runMigrations(db: Db, migrationsDir: string): string[] {
  db.exec(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
       name       TEXT PRIMARY KEY,
       applied_at TEXT NOT NULL
     )`
  );

  const applied = new Set<string>(
    (
      db.prepare("SELECT name FROM schema_migrations").all() as { name: string }[]
    ).map((r) => r.name)
  );

  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const apply = db.transaction((name: string, sql: string) => {
    db.exec(sql);
    db.prepare("INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)").run(
      name,
      new Date().toISOString()
    );
  });

  const appliedNow: string[] = [];
  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = readFileSync(path.join(migrationsDir, file), "utf8");
    apply(file, sql);
    appliedNow.push(file);
  }
  return appliedNow;
}

/** Default on-disk location of the demo database (repo root / data). */
export function defaultDbPath(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, "../../../../data/threat-aware-mfa.db");
}
