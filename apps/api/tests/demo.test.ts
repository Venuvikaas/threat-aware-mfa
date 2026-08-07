/**
 * Demo route tests (docs/EXECUTION.md Phase 5/9).
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

describe("GET /api/v1/demo/users", () => {
  it("returns synthetic identity presets with devices and enrollment", async () => {
    const res = await request(createApp({ db, demoMode: true })).get("/api/v1/demo/users");
    expect(res.status).toBe(200);
    const users = res.body.users;
    expect(users).toHaveLength(2);
    const aarav = users.find((u: { id: string }) => u.id === "user_demo_01");
    expect(aarav.passkeyEnrolled).toBe(true);
    expect(aarav.devices.length).toBe(2);
    expect(aarav.devices.find((d: { id: string }) => d.id === "dev_trusted_01").trusted).toBe(
      true
    );
  });
});

describe("GET /api/v1/demo/baseline", () => {
  it("returns the fair scalar baseline for a risk level", async () => {
    const res = await request(createApp({ db, demoMode: true })).get(
      "/api/v1/demo/baseline?riskLevel=HIGH"
    );
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      requiredAssurance: 2,
      requirement: "Phishing-resistant factor required",
    });
  });

  it("rejects an unknown risk level", async () => {
    const res = await request(createApp({ db, demoMode: true })).get(
      "/api/v1/demo/baseline?riskLevel=CRITICAL"
    );
    expect(res.status).toBe(400);
  });
});

describe("POST /api/v1/demo/reset", () => {
  it("resets only demo transactions in demo mode", async () => {
    const api = createApp({ db, demoMode: true });
    const created = (
      await request(api)
        .post("/api/v1/decisions")
        .send({
          userId: "user_demo_01",
          transaction: {
            clientTransactionId: "txn_reset_001",
            amountMinor: 5_000_000,
            currency: "INR",
            payeeId: "payee_new_77",
            payeeIsKnown: false,
          },
          session: {
            sessionId: "sess_unusual_01",
            ageSeconds: 120,
            failedLoginCount: 0,
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
        })
    ).body;

    const res = await request(api).post("/api/v1/demo/reset");
    expect(res.status).toBe(200);
    expect(res.body.reset).toBe(true);

    const after = await request(api).get(`/api/v1/decisions/${created.decisionId}`);
    expect(after.status).toBe(404);
  });

  it("is disabled outside demo mode", async () => {
    const res = await request(createApp({ db, demoMode: false })).post("/api/v1/demo/reset");
    expect(res.status).toBe(403);
  });
});
