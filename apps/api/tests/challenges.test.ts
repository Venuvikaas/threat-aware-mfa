/**
 * Server-side challenge enforcement (EXECUTION_new2.md Phase 4 exit gate).
 *
 * - The policy changes executable backend behavior: an ineligible factor can
 *   never create a challenge through the direct API (POLICY_REJECTION).
 * - Unavailable (capability-missing) and non-selected factors are rejected.
 * - The selected simulated passkey adapter completes once only.
 * - Expired and consumed challenges are rejected; outcome trace events are
 *   appended.
 */
import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { fileURLToPath } from "node:url";
import { createApp } from "../src/app.js";
import { openDatabase, runMigrations, type Db } from "../src/db/connection.js";
import { seedDemoData } from "../src/db/seed.js";
import { simSwapScenario, constrainedCapabilityScenario } from "@mfa/demo-data";
import type { CreateDecisionRequest } from "@mfa/contracts";

const migrationsDir = fileURLToPath(new URL("../src/db/migrations", import.meta.url));

let db: Db;
let app: ReturnType<typeof createApp>;

beforeEach(() => {
  db = openDatabase(":memory:");
  runMigrations(db, migrationsDir);
  seedDemoData(db);
  app = createApp({ db, demoMode: true });
});

async function createDecision(req: CreateDecisionRequest) {
  const res = await request(app).post("/api/v1/decisions").send(req);
  return res.body as {
    decisionId: string;
    action: string;
    selectedFactorId?: string | null;
    factors: { factorId: string; status: string }[];
  };
}

describe("POST /api/v1/challenges", () => {
  it("creates a labeled SIMULATED passkey challenge for the selected factor", async () => {
    const decision = await createDecision(simSwapScenario.build("ct_ch_1"));
    expect(
      decision.selectedFactorId ?? decision.factors.find((f) => f.status === "ELIGIBLE")?.factorId
    ).toBe("PASSKEY");

    const res = await request(app)
      .post("/api/v1/challenges")
      .send({ decisionId: decision.decisionId, factor: "PASSKEY" });
    expect(res.status).toBe(201);
    expect(res.body.mode).toBe("SIMULATED");
    expect(res.body.factor).toBe("PASSKEY");
    expect(res.body.expiresAt).toBeTruthy();
  });

  it("rejects an ineligible factor — the policy-enforcement proof point", async () => {
    const decision = await createDecision(simSwapScenario.build("ct_ch_2"));
    const res = await request(app)
      .post("/api/v1/challenges")
      .send({ decisionId: decision.decisionId, factor: "SMS_OTP" });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("POLICY_REJECTION");
    expect(res.body.error.details.status).toBe("INELIGIBLE");
  });

  it("rejects an unavailable factor (capability missing)", async () => {
    // In the constrained scenario the passkey is UNAVAILABLE (no enrollment),
    // so no challenge can be created for it.
    const decision = await createDecision(constrainedCapabilityScenario.build("ct_ch_3"));
    const res = await request(app)
      .post("/api/v1/challenges")
      .send({ decisionId: decision.decisionId, factor: "PASSKEY" });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("POLICY_REJECTION");
    expect(res.body.error.details.status).toBe("UNAVAILABLE");
  });

  it("returns 404 for an unknown decision", async () => {
    const res = await request(app)
      .post("/api/v1/challenges")
      .send({ decisionId: "dec_ghost", factor: "PASSKEY" });
    expect(res.status).toBe(404);
  });
});

describe("POST /api/v1/challenges/:id/verify", () => {
  it("authorizes the transaction with a simulated success response", async () => {
    const decision = await createDecision(simSwapScenario.build("ct_ch_v1"));
    const created = await request(app)
      .post("/api/v1/challenges")
      .send({ decisionId: decision.decisionId, factor: "PASSKEY" });
    const challengeId = created.body.challengeId;

    const res = await request(app)
      .post(`/api/v1/challenges/${challengeId}/verify`)
      .send({ challengeId, response: { simulatedOk: true } });
    expect(res.status).toBe(200);
    expect(res.body.verified).toBe(true);
    expect(res.body.transactionStatus).toBe("AUTHORIZED");

    // Outcome trace event appended to the decision.
    const trace = await request(app).get(`/api/v1/decisions/${decision.decisionId}/trace`);
    const outcome = trace.body.find((e: any) => e.phase === "OUTCOME");
    expect(outcome.explanationCode).toBe("challenge_verified");
  });

  it("denies the transaction when the simulated response fails", async () => {
    const decision = await createDecision(simSwapScenario.build("ct_ch_v2"));
    const created = await request(app)
      .post("/api/v1/challenges")
      .send({ decisionId: decision.decisionId, factor: "PASSKEY" });

    const res = await request(app)
      .post(`/api/v1/challenges/${created.body.challengeId}/verify`)
      .send({ challengeId: created.body.challengeId, response: { simulatedOk: false } });
    expect(res.status).toBe(200);
    expect(res.body.verified).toBe(false);
    expect(res.body.transactionStatus).toBe("DENIED");
  });

  it("rejects replay of an already-consumed challenge", async () => {
    const decision = await createDecision(simSwapScenario.build("ct_ch_v3"));
    const created = await request(app)
      .post("/api/v1/challenges")
      .send({ decisionId: decision.decisionId, factor: "PASSKEY" });
    const challengeId = created.body.challengeId;

    await request(app)
      .post(`/api/v1/challenges/${challengeId}/verify`)
      .send({ challengeId, response: { simulatedOk: true } });

    const replay = await request(app)
      .post(`/api/v1/challenges/${challengeId}/verify`)
      .send({ challengeId, response: { simulatedOk: true } });
    expect(replay.status).toBe(409);
    expect(replay.body.error.code).toBe("CHALLENGE_ERROR");
  });

  it("rejects an expired challenge", async () => {
    const decision = await createDecision(simSwapScenario.build("ct_ch_v4"));
    const created = await request(app)
      .post("/api/v1/challenges")
      .send({ decisionId: decision.decisionId, factor: "PASSKEY" });
    const challengeId = created.body.challengeId;

    // Backdate the expiry so the challenge is stale.
    db.prepare("UPDATE challenges SET expires_at = '2000-01-01T00:00:00.000Z' WHERE id = ?").run(
      challengeId
    );

    const res = await request(app)
      .post(`/api/v1/challenges/${challengeId}/verify`)
      .send({ challengeId, response: { simulatedOk: true } });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("CHALLENGE_ERROR");
  });

  it("rejects an unknown challenge and a URL/body mismatch", async () => {
    const unknown = await request(app)
      .post("/api/v1/challenges/ch_ghost/verify")
      .send({ challengeId: "ch_ghost", response: {} });
    expect(unknown.status).toBe(409);
    expect(unknown.body.error.code).toBe("CHALLENGE_ERROR");

    const mismatch = await request(app)
      .post("/api/v1/challenges/ch_a/verify")
      .send({ challengeId: "ch_b", response: {} });
    expect(mismatch.status).toBe(400);
    expect(mismatch.body.error.code).toBe("VALIDATION_ERROR");
  });
});
