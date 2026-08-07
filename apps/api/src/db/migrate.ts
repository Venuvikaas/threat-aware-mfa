/**
 * CLI entry for applying migrations to a real database file:
 *
 *   npm run db:migrate -w @mfa/api
 *
 * Honors DB_PATH (default: data/threat-aware-mfa.db).
 */
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defaultDbPath, openDatabase, runMigrations } from "./connection.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.DB_PATH ?? defaultDbPath();

mkdirSync(path.dirname(dbPath), { recursive: true });
const db = openDatabase(dbPath);
const applied = runMigrations(db, path.join(here, "migrations"));
console.log(
  applied.length
    ? `[db] applied: ${applied.join(", ")}`
    : "[db] no pending migrations"
);
console.log(`[db] database: ${dbPath}`);
db.close();
