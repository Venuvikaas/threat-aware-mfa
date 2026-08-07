/**
 * WebAuthn stretch (EXECUTION_new2.md Stretch A) — labeled fallback.
 *
 * The PASSKEY factor adapter runs a real WebAuthn ceremony only when the
 * user has a registered credential AND the origin is a WebAuthn-capable
 * secure context; otherwise the challenge comes back mode SIMULATED, and the
 * challenge response's `mode` field keeps the choice explicit (never
 * ambiguous).
 */
import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { fileURLToPath } from "node:url";
import { createApp } from "../src/app.js";
import { openDatabase, runMigrations, type Db } from "../src/db/connection.js";
import { seedDemoData } from "../src/db/seed.js";
import { simSwapScenario } from "@mfa/demo-data";

const migrationsDir = fileURLToPath(new URL("../src/db/migrations", import.meta.url));

let db: Db;
let app: ReturnType<typeof createApp>;

beforeEach(() => {
  db = openDatabase(":memory:");
  runMigrations(db, migrationsDir);
  seedDemoData(db);
  app = createApp({ db, demoMode: true });
});

describe("PASSKEY challenge mode selection (stretch)", () => {
  it("falls back to the labeled SIMULATED mode when no credential is registered", async () => {
    // user_demo_02 has no passkey credential; create a decision where passkey
    // is eligible (use sim-swap scenario but that user has no real credential
    // rows — the adapter sees zero credentials -> simulated).
    const decision = await request(app)
      .post("/api/v1/decisions")
      .send(simSwapScenario.build("ct_wa_1"));
    const decisionId = (decision.body as { decisionId: string }).decisionId;

    const res = await request(app)
      .post("/api/v1/challenges")
      .send({ decisionId, factor: "PASSKEY" });
    expect(res.status).toBe(201);
    expect(res.body.mode).toBe("SIMULATED");
  });

  it("honors preferSimulated (demo-only hint) and rejects it outside demo mode", async () => {
    const decision = await request(app)
      .post("/api/v1/decisions")
      .send(simSwapScenario.build("ct_wa_2"));
    const decisionId = (decision.body as { decisionId: string }).decisionId;

    const res = await request(app)
      .post("/api/v1/challenges")
      .send({ decisionId, factor: "PASSKEY", preferSimulated: true });
    expect(res.status).toBe(201);
    expect(res.body.mode).toBe("SIMULATED");

    // Outside demo mode the hint is rejected.
    const strictApp = createApp({ db, demoMode: false });
    const strict = await request(strictApp)
      .post("/api/v1/challenges")
      .send({ decisionId, factor: "PASSKEY", preferSimulated: true });
    expect(strict.status).toBe(400);
    expect(strict.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("reports WEBAUTHN mode when a credential exists and the origin is secure", async () => {
    // Seed a synthetic public credential for user_demo_01 (public data only).
    db.prepare(
      `INSERT INTO passkey_credentials (id, user_id, public_key, counter, transports, backed_up, created_at)
       VALUES ('cred_1', 'user_demo_01', 'AQID', 1, '[]', 1, '2026-08-07T00:00:00.000Z')`
    ).run();

    const decision = await request(app)
      .post("/api/v1/decisions")
      .send(simSwapScenario.build("ct_wa_3"));
    const decisionId = (decision.body as { decisionId: string }).decisionId;

    const res = await request(app)
      .post("/api/v1/challenges")
      .set("Origin", "http://localhost:5173")
      .send({ decisionId, factor: "PASSKEY" });
    // Real ceremony requested (options present), but the browser must complete
    // it — we only assert the mode selection here.
    expect(res.status).toBe(201);
    expect(res.body.mode).toBe("WEBAUTHN");
    expect(res.body.publicOptions).toBeTruthy();
  });
});
