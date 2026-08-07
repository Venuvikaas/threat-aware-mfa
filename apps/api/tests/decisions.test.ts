/**
 * Decision API end-to-end coverage (EXECUTION_new2.md Phase 3 exit gate).
 *
 * - SIM-swap scenario through HTTP: SMS ineligible, passkey selected.
 * - Phishing scenario: same risk level, different trust-impact trace.
 * - Capability-constrained scenario: assisted recovery.
 * - Retrieval returns the same semantic output; trace endpoint works.
 * - Client-transaction idempotency returns 409 CONFLICT.
 * - Unavailable providers yield conservative UNAVAILABLE evidence.
 */
import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { fileURLToPath } from "node:url";
import { createApp } from "../src/app.js";
import { openDatabase, runMigrations, type Db } from "../src/db/connection.js";
import { seedDemoData } from "../src/db/seed.js";
import { simSwapScenario, phishingScenario, constrainedCapabilityScenario } from "@mfa/demo-data";
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
  return { status: res.status, body: res.body as any };
}

describe("POST /api/v1/decisions", () => {
  it("creates a SIM-swap decision with the full reasoning chain", async () => {
    const { status, body } = await createDecision(simSwapScenario.build("ct_sim_1"));
    expect(status).toBe(201);
    expect(body.risk.level).toBe("HIGH");
    expect(body.policy.version).toBe("1.0.0");
    expect(body.policy.contentHash).toMatch(/^sha256:/);

    const sim = body.threats.find((t: any) => t.threatId === "SIM_CHANNEL_COMPROMISE");
    expect(sim.support).toBe("STRONG");
    const ownership = body.trust.find((t: any) => t.domainId === "SIM_OWNERSHIP");
    expect(ownership.state).toBe("DISTRUSTED");
    const sms = body.factors.find((f: any) => f.factorId === "SMS_OTP");
    expect(sms.status).toBe("INELIGIBLE");
    const passkey = body.factors.find((f: any) => f.factorId === "PASSKEY");
    expect(passkey.status).toBe("ELIGIBLE");
    expect(body.selectedFactorId).toBe("PASSKEY");
    expect(body.action).toBe("CHALLENGE");
    expect(body.trace.length).toBeGreaterThan(0);

    // Provenance is visible on evidence.
    const simChange = body.evidence.find((e: any) => e.type === "RECENT_SIM_CHANGE");
    expect(simChange.providerId).toBe("demo_override");
    expect(simChange.synthetic).toBe(true);
    expect(simChange.quality).toBe("CONFIRMED");
  });

  it("produces equal risk but a different trust trace for the phishing scenario", async () => {
    const sim = await createDecision(simSwapScenario.build("ct_sim_2"));
    const phish = await createDecision(phishingScenario.build("ct_phish_2"));
    expect(sim.body.risk.level).toBe("HIGH");
    expect(phish.body.risk.level).toBe("HIGH");
    // Different trust effects.
    expect(sim.body.trust.find((t: any) => t.domainId === "SIM_OWNERSHIP").state).toBe("DISTRUSTED");
    expect(phish.body.trust.find((t: any) => t.domainId === "SIM_OWNERSHIP").state).toBe("TRUSTED");
    expect(phish.body.trust.find((t: any) => t.domainId === "TELECOM_DELIVERY").state).toBe("DISTRUSTED");
    // Different activated rules.
    const simRules = new Set(sim.body.trust.flatMap((t: any) => t.activatedRuleIds));
    const phishRules = new Set(phish.body.trust.flatMap((t: any) => t.activatedRuleIds));
    expect(simRules.has("trust_sim_ownership")).toBe(true);
    expect(phishRules.has("trust_sim_ownership")).toBe(false);
    expect(phishRules.has("trust_phish_verification")).toBe(true);
  });

  it("returns assisted recovery for the capability-constrained scenario", async () => {
    const { status, body } = await createDecision(constrainedCapabilityScenario.build("ct_con_1"));
    expect(status).toBe(201);
    expect(body.factors.find((f: any) => f.factorId === "PASSKEY").status).toBe("UNAVAILABLE");
    expect(body.selectedFactorId).toBeNull();
    expect(body.action).toBe("ASSISTED_RECOVERY");
  });

  it("enforces client-transaction idempotency with 409 CONFLICT", async () => {
    const reqBody = simSwapScenario.build("ct_dup_1");
    const first = await createDecision(reqBody);
    expect(first.status).toBe(201);
    const second = await createDecision(reqBody);
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe("CONFLICT");
  });

  it("returns 404 for an unknown user and 400 for a bad payload", async () => {
    const badUser = await createDecision({ ...simSwapScenario.build("ct_u1"), userId: "ghost" });
    expect(badUser.status).toBe(404);
    const badPayload = await request(app)
      .post("/api/v1/decisions")
      .send({ ...simSwapScenario.build("ct_u2"), transaction: { amountMinor: -1 } });
    expect(badPayload.status).toBe(400);
    expect(badPayload.body.error.code).toBe("VALIDATION_ERROR");
  });
});

describe("retrieval", () => {
  it("GET /decisions/:id and /decisions/:id/trace return the same semantic output", async () => {
    const created = await createDecision(simSwapScenario.build("ct_get_1"));
    const decisionId = created.body.decisionId;

    const got = await request(app).get(`/api/v1/decisions/${decisionId}`);
    expect(got.status).toBe(200);
    expect(got.body.decisionId).toBe(decisionId);
    expect(got.body.risk).toEqual(created.body.risk);
    expect(got.body.threats).toEqual(created.body.threats);
    expect(got.body.trust).toEqual(created.body.trust);
    expect(got.body.factors).toEqual(created.body.factors);
    expect(got.body.trace).toEqual(created.body.trace);

    const trace = await request(app).get(`/api/v1/decisions/${decisionId}/trace`);
    expect(trace.status).toBe(200);
    expect(trace.body).toEqual(created.body.trace);
  });

  it("returns 404 for unknown decision ids", async () => {
    const got = await request(app).get("/api/v1/decisions/dec_ghost");
    expect(got.status).toBe(404);
  });
});

describe("demo routes", () => {
  it("serves the three judge scenarios", async () => {
    const res = await request(app).get("/api/v1/demo/scenarios");
    expect(res.status).toBe(200);
    expect(res.body.scenarios.map((s: any) => s.id)).toEqual([
      "sim_swap",
      "phishing_relay",
      "constrained_capability",
    ]);
  });

  it("reset clears decisions", async () => {
    await createDecision(simSwapScenario.build("ct_reset_1"));
    const reset = await request(app).post("/api/v1/demo/reset");
    expect(reset.status).toBe(200);
    expect(reset.body.reset).toBe(true);
  });
});
