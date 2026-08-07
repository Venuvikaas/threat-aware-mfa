/**
 * Challenge lifecycle tests (docs/EXECUTION.md Phase 6 exit gate):
 * allowed challenge creation, blocked-factor rejection, expiry, replay, and
 * transaction-state updates.
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

async function createSimSwapDecision(): Promise<{ decisionId: string }> {
  const res = await request(api).post("/api/v1/decisions").send({
    userId: "user_demo_01",
    transaction: {
      clientTransactionId: `txn_ch_${Date.now()}_${Math.random().toString(36).slice(2)}`,
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
  return { decisionId: res.body.decisionId };
}

describe("POST /api/v1/challenges", () => {
  it("creates a SIMULATED passkey challenge for an allowed factor", async () => {
    const { decisionId } = await createSimSwapDecision();
    const res = await request(api)
      .post("/api/v1/challenges")
      .send({ decisionId, factor: "PASSKEY" });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      factor: "PASSKEY",
      mode: "SIMULATED",
    });
    expect(typeof res.body.challengeId).toBe("string");
    expect(new Date(res.body.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  it("rejects a blocked factor — the policy-enforcement proof point", async () => {
    const { decisionId } = await createSimSwapDecision();
    const res = await request(api)
      .post("/api/v1/challenges")
      .send({ decisionId, factor: "SMS_OTP" });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("POLICY_REJECTION");
    expect(res.body.error.details.status).toBe("BLOCKED");
    expect(res.body.error.details.reasonCode).toBe("sms_channel_untrusted");
  });

  it("rejects an unavailable factor", async () => {
    const res = await request(api).post("/api/v1/decisions").send({
      userId: "user_demo_02", // passkey not enrolled
      transaction: {
        clientTransactionId: `txn_ch_unavail_${Date.now()}`,
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
    const { decisionId } = res.body;
    const challenge = await request(api)
      .post("/api/v1/challenges")
      .send({ decisionId, factor: "PASSKEY" });
    expect(challenge.status).toBe(409);
    expect(challenge.body.error.code).toBe("POLICY_REJECTION");
    expect(challenge.body.error.details.status).toBe("UNAVAILABLE");
  });

  it("rejects challenge creation for an unknown decision", async () => {
    const res = await request(api)
      .post("/api/v1/challenges")
      .send({ decisionId: "dec_missing", factor: "PASSKEY" });
    expect(res.status).toBe(404);
  });
});

describe("POST /api/v1/challenges/:id/verify", () => {
  async function createChallenge() {
    const { decisionId } = await createSimSwapDecision();
    const created = await request(api)
      .post("/api/v1/challenges")
      .send({ decisionId, factor: "PASSKEY" });
    return { challenge: created.body };
  }

  it("authorizes the transaction with a simulated success response", async () => {
    const { challenge } = await createChallenge();
    const res = await request(api)
      .post(`/api/v1/challenges/${challenge.challengeId}/verify`)
      .send({ challengeId: challenge.challengeId, response: { simulatedOk: true } });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      challengeId: challenge.challengeId,
      verified: true,
      transactionStatus: "AUTHORIZED",
    });
  });

  it("denies the transaction when the simulated response fails", async () => {
    const { challenge } = await createChallenge();
    const res = await request(api)
      .post(`/api/v1/challenges/${challenge.challengeId}/verify`)
      .send({ challengeId: challenge.challengeId, response: { simulatedOk: false } });
    expect(res.body.verified).toBe(false);
    expect(res.body.transactionStatus).toBe("DENIED");
  });

  it("rejects replay of an already-consumed challenge", async () => {
    const { challenge } = await createChallenge();
    await request(api)
      .post(`/api/v1/challenges/${challenge.challengeId}/verify`)
      .send({ challengeId: challenge.challengeId, response: { simulatedOk: true } });
    const replay = await request(api)
      .post(`/api/v1/challenges/${challenge.challengeId}/verify`)
      .send({ challengeId: challenge.challengeId, response: { simulatedOk: true } });
    expect(replay.status).toBe(409);
    expect(replay.body.error.code).toBe("CHALLENGE_ERROR");
  });

  it("rejects an expired challenge", async () => {
    const { challenge } = await createChallenge();
    db.prepare("UPDATE challenges SET expires_at = ? WHERE id = ?").run(
      "2020-01-01T00:00:00.000Z",
      challenge.challengeId
    );
    const res = await request(api)
      .post(`/api/v1/challenges/${challenge.challengeId}/verify`)
      .send({ challengeId: challenge.challengeId, response: { simulatedOk: true } });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("CHALLENGE_ERROR");
  });

  it("rejects an unknown challenge", async () => {
    const res = await request(api)
      .post("/api/v1/challenges/ch_missing/verify")
      .send({ challengeId: "ch_missing", response: { simulatedOk: true } });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("CHALLENGE_ERROR");
  });
});
