/**
 * Server bootstrap: open the database, apply migrations, seed deterministic
 * demo data, then listen.
 */
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "./app.js";
import { defaultDbPath, openDatabase, runMigrations } from "./db/connection.js";
import { seedDemoData } from "./db/seed.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.DB_PATH ?? defaultDbPath();

mkdirSync(path.dirname(dbPath), { recursive: true });
const db = openDatabase(dbPath);
const applied = runMigrations(db, path.join(here, "db/migrations"));
if (applied.length > 0) {
  console.log(`[api] applied migrations: ${applied.join(", ")}`);
}
seedDemoData(db);

const demoMode = process.env.DEMO_MODE !== "false";
const app = createApp({ db, demoMode });

const port = Number(process.env.PORT ?? 4000);
app.listen(port, () => {
  console.log(
    `[api] Threat-Aware MFA Decision Service listening on http://localhost:${port} (demo mode: ${demoMode})`
  );
});
