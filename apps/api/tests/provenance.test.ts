/**
 * Tests for the demo-facing provenance and enrollment endpoints used by the
 * client (docs/EXECUTION.md Phase 5/9).
 */
import { describe, expect, it, beforeEach } from "vitest";
import request from "supertest";
import { fileURLToPath } from "node:url";
import { createApp } from "../src/app.js";
import { openDatabase, runMigrations, type Db } from "../src/db/connection.js";

const migrationsDir = fileURLToPath(new URL("../src/db/migrations", import.meta.url));

let db: Db;
let api: ReturnType<typeof createApp>;

beforeEach(() => {
  db = openDatabase(":memory:");
  runMigrations(db, migrationsDir);
  api = createApp({ db, demoMode: true });
});

async function createDecision(clientTransactionId: string) {
  const res = await request(api).post("/api/v1/decisions").send({
    userId: "user_demo_01",
    transaction: {
      clientTransactionId,
      amountMinor: 5_000_000,
      currency: "INR",
      payeeId: "payee_new_77",
      payeeIsKnown: false,
    },
    session: {
      sessionId: "sess_unusual_01",
      ageSeconds: 120,
      failedLoginCount: 2,
      ipAddress: "198.51.100.44",
      asn: "AS16509",
      country: "US",
    },
    device: {
      deviceId: "dev_new_01",
      trusted: false,
      firstSeen: true,
      browserFingerprint: "fp-1",
    },
    signals: {
      recentSimChange: true,
      geoDistanceFromLastLoginKm: null,
      phishingRelayIndicator: false,
    },
  });
  expect(res.status).toBe(201);
  return res.body;
}

describe("GET /api/v1/decisions/:id/signals", () => {
  it("returns persisted signal provenance tagged synthetic", async () => {
    const { decisionId } = await createDecision("txn_prov_001");
    const res = await request(api).get(`/api/v1/decisions/${decisionId}/signals`);
    expect(res.status).toBe(200);
    const sim = res.body.find((s: { name: string }) => s.name === "recent_sim_change");
    expect(sim).toMatchObject({
      value: true,
      source: "demo_override",
      synthetic: true,
    });
    const geo = res.body.find(
      (s: { name: string }) => s.name === "geo_distance_from_last_login_km"
    );
    expect(geo.value).toBeNull();
    for (const s of res.body) {
      expect(s.synthetic).toBe(true);
      expect(typeof s.observedAt).toBe("string");
    }
  });

  it("returns 404 for an unknown decision", async () => {
    const res = await request(api).get("/api/v1/decisions/dec_missing/signals");
    expect(res.status).toBe(404);
  });
});

describe("POST /api/v1/demo/users/:userId/passkey-enrollment", () => {
  it("toggles passkey enrollment for a demo user", async () => {
    const off = await request(api)
      .post("/api/v1/demo/users/user_demo_01/passkey-enrollment")
      .send({ enrolled: false });
    expect(off.status).toBe(200);
    expect(off.body).toEqual({ userId: "user_demo_01", passkeyEnrolled: false });

    const users = await request(api).get("/api/v1/demo/users");
    expect(
      users.body.users.find((u: { id: string }) => u.id === "user_demo_01")
        .passkeyEnrolled
    ).toBe(false);
  });

  it("is disabled outside demo mode", async () => {
    const prod = createApp({ db, demoMode: false });
    const res = await request(prod)
      .post("/api/v1/demo/users/user_demo_01/passkey-enrollment")
      .send({ enrolled: false });
    expect(res.status).toBe(403);
  });
});
