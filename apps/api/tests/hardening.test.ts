/**
 * Hardening tests (docs/EXECUTION.md Phase 8 exit gate):
 * payload size limits, malformed JSON, rate limiting, CORS origin
 * restriction, and correlation IDs on responses and errors.
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

function validPayload(clientTransactionId: string) {
  return {
    userId: "user_demo_01",
    transaction: {
      clientTransactionId,
      amountMinor: 5000,
      currency: "INR",
      payeeId: "payee_known_01",
      payeeIsKnown: true,
    },
    session: {
      sessionId: "sess_home_01",
      ageSeconds: 3600,
      failedLoginCount: 0,
      ipAddress: "203.0.113.10",
      asn: "AS14061",
      country: "IN",
    },
    device: {
      deviceId: "dev_trusted_01",
      trusted: true,
      firstSeen: false,
      browserFingerprint: "fp-home",
    },
    signals: {
      recentSimChange: false,
      geoDistanceFromLastLoginKm: 10,
      phishingRelayIndicator: false,
    },
  };
}

describe("payload limits", () => {
  it("rejects an oversized request body with 413", async () => {
    const payload = validPayload("txn_oversize");
    payload.transaction.payeeId = "x".repeat(40_000); // push past the 32kb limit
    const res = await request(createApp({ db, demoMode: true }))
      .post("/api/v1/decisions")
      .send(payload);
    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe("PAYLOAD_TOO_LARGE");
  });

  it("returns VALIDATION_ERROR for malformed JSON", async () => {
    const res = await request(createApp({ db, demoMode: true }))
      .post("/api/v1/decisions")
      .set("Content-Type", "application/json")
      .send('{"userId": "user_demo_01", broken');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });
});

describe("rate limiting", () => {
  it("rejects requests beyond the configured limit with 429", async () => {
    const api = createApp({
      db,
      demoMode: true,
      rateLimitCount: 3,
      rateLimitWindowMs: 60_000,
    });
    for (let i = 0; i < 3; i++) {
      const res = await request(api).post("/api/v1/decisions").send(validPayload(`txn_rl_${i}`));
      expect(res.status).toBe(201);
    }
    const blocked = await request(api).post("/api/v1/decisions").send(validPayload("txn_rl_3"));
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe("RATE_LIMITED");
  });
});

describe("CORS", () => {
  it("allows the configured frontend origin", async () => {
    const res = await request(createApp({ db, demoMode: true, allowedOrigin: "http://localhost:5173" }))
      .get("/health")
      .set("Origin", "http://localhost:5173");
    expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
  });

  it("does not reflect a disallowed origin", async () => {
    const res = await request(createApp({ db, demoMode: true, allowedOrigin: "http://localhost:5173" }))
      .get("/health")
      .set("Origin", "http://evil.example");
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });
});

describe("correlation ids", () => {
  it("echoes an inbound correlation id on the response", async () => {
    const res = await request(createApp({ db, demoMode: true }))
      .get("/health")
      .set("x-correlation-id", "corr-abc-123");
    expect(res.headers["x-correlation-id"]).toBe("corr-abc-123");
  });

  it("generates a correlation id when none is supplied", async () => {
    const res = await request(createApp({ db, demoMode: true })).get("/health");
    expect(typeof res.headers["x-correlation-id"]).toBe("string");
    expect(res.headers["x-correlation-id"]).toHaveLength(16);
  });

  it("includes the correlation id in error responses", async () => {
    const res = await request(createApp({ db, demoMode: true }))
      .get("/api/v1/decisions/dec_missing")
      .set("x-correlation-id", "corr-error-1");
    expect(res.status).toBe(404);
    expect(res.body.error.correlationId).toBe("corr-error-1");
  });
});
