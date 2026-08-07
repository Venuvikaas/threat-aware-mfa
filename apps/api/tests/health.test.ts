/**
 * Health endpoint + error-shape tests (docs/EXECUTION.md Phase 1).
 */
import { describe, expect, it, beforeEach } from "vitest";
import request from "supertest";
import { fileURLToPath } from "node:url";
import { createApp } from "../src/app.js";
import { openDatabase, runMigrations, type Db } from "../src/db/connection.js";

const migrationsDir = fileURLToPath(new URL("../src/db/migrations", import.meta.url));

let db: Db;

beforeEach(() => {
  db = openDatabase(":memory:");
  runMigrations(db, migrationsDir);
});

describe("GET /health", () => {
  it("reports ok with a reachable database", async () => {
    const res = await request(createApp({ db })).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      status: "ok",
      service: "threat-aware-mfa-api",
      database: "ok",
    });
    expect(typeof res.body.time).toBe("string");
  });

  it("reports degraded when the database is unavailable", async () => {
    db.close();
    const res = await request(createApp({ db })).get("/health");
    expect(res.status).toBe(503);
    expect(res.body.database).toBe("error");
  });
});

describe("error shape", () => {
  it("returns the frozen error shape for unknown routes", async () => {
    const res = await request(createApp({ db })).get("/does-not-exist");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      error: { code: "NOT_FOUND", message: "Route not found" },
    });
  });
});
