/**
 * Replay API coverage (EXECUTION_new2.md Phase 6 exit gate).
 *
 * - EXACT replay produces a semantically identical decision (empty diff).
 * - FORK replay (passkey unavailable) changes only declared inputs: threat
 *   and SIM trust stay identical; passkey becomes unavailable and the
 *   outcome becomes assisted recovery — captured in FACTOR + SELECTION deltas.
 * - The original decision is never mutated (immutable lineage).
 * - Unknown decisions and invalid bodies fail cleanly.
 */
import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { fileURLToPath } from "node:url";
import { createApp } from "../src/app.js";
import { openDatabase, runMigrations, type Db } from "../src/db/connection.js";
import { seedDemoData } from "../src/db/seed.js";
import { constrainedCapabilityScenario, simSwapScenario } from "@mfa/demo-data";

const migrationsDir = fileURLToPath(new URL("../src/db/migrations", import.meta.url));

let db: Db;
let app: ReturnType<typeof createApp>;

beforeEach(() => {
  db = openDatabase(":memory:");
  runMigrations(db, migrationsDir);
  seedDemoData(db);
  app = createApp({ db, demoMode: true });
});

async function createSimDecision(clientTransactionId = "ct_replay_1") {
  const res = await request(app).post("/api/v1/decisions").send(simSwapScenario.build(clientTransactionId));
  return { status: res.status, body: res.body as any };
}

describe("POST /api/v1/decisions/:decisionId/replays", () => {
  it("EXACT replay produces a semantically identical decision (empty diff)", async () => {
    const { body: source } = await createSimDecision();
    const res = await request(app)
      .post(`/api/v1/decisions/${source.decisionId}/replays`)
      .send({ mode: "EXACT" });
    expect(res.status).toBe(201);
    const record = res.body;
    expect(record.mode).toBe("EXACT");
    expect(record.sourceDecisionId).toBe(source.decisionId);
    expect(record.producedDecisionId).toBeTruthy();

    const produced = await request(app).get(`/api/v1/decisions/${record.producedDecisionId}`);
    expect(produced.status).toBe(200);
    expect(produced.body.risk.level).toBe(source.risk.level);
    expect(produced.body.selectedFactorId).toBe(source.selectedFactorId);
    expect(produced.body.action).toBe(source.action);

    const diff = await request(app).get(`/api/v1/replays/${record.replayId}/diff`);
    expect(diff.status).toBe(200);
    expect(diff.body.identical).toBe(true);
    expect(diff.body.sections).toEqual([]);
  });

  it("FORK replay with passkey unavailable shows FACTOR + SELECTION deltas, never THREAT/TRUST", async () => {
    const { body: source } = await createSimDecision();
    const res = await request(app)
      .post(`/api/v1/decisions/${source.decisionId}/replays`)
      .send({
        mode: "FORK",
        capabilityChanges: [{ capabilityId: "PASSKEY_ENROLLED", available: false }],
      });
    expect(res.status).toBe(201);
    const record = res.body;

    const produced = await request(app).get(`/api/v1/decisions/${record.producedDecisionId}`);
    expect(produced.status).toBe(200);
    const passkey = produced.body.factors.find((f: any) => f.factorId === "PASSKEY");
    expect(passkey.status).toBe("UNAVAILABLE");
    expect(produced.body.selectedFactorId).toBeNull();
    expect(produced.body.action).toBe("ASSISTED_RECOVERY");

    const diff = await request(app).get(`/api/v1/replays/${record.replayId}/diff`);
    expect(diff.status).toBe(200);
    expect(diff.body.identical).toBe(false);
    const sections = diff.body.sections.map((s: any) => s.section);
    expect(sections).toContain("FACTOR");
    expect(sections).toContain("SELECTION");
    // Threat and SIM trust states remain unchanged by a capability fork.
    expect(sections).not.toContain("THREAT");
    expect(sections).not.toContain("TRUST");
  });

  it("never mutates the original decision", async () => {
    const { body: source } = await createSimDecision();
    await request(app)
      .post(`/api/v1/decisions/${source.decisionId}/replays`)
      .send({ mode: "FORK", evidenceChanges: [{ type: "RECENT_SIM_CHANGE", value: false }] });

    const after = await request(app).get(`/api/v1/decisions/${source.decisionId}`);
    expect(after.status).toBe(200);
    expect(after.body.selectedFactorId).toBe(source.selectedFactorId);
    expect(after.body.action).toBe(source.action);
    expect(after.body.evidence.find((e: any) => e.type === "RECENT_SIM_CHANGE").value).toBe(true);
  });

  it("rejects EXACT replay that declares changes", async () => {
    const { body: source } = await createSimDecision();
    const res = await request(app)
      .post(`/api/v1/decisions/${source.decisionId}/replays`)
      .send({ mode: "EXACT", evidenceChanges: [{ type: "RECENT_SIM_CHANGE", value: false }] });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("REPLAY_ERROR");
  });

  it("returns 404 for an unknown source decision, unknown policy, and 400 for a bad body", async () => {
    const notFound = await request(app)
      .post("/api/v1/decisions/dec_ghost/replays")
      .send({ mode: "EXACT" });
    expect(notFound.status).toBe(404);

    const bad = await request(app)
      .post("/api/v1/decisions/dec_ghost/replays")
      .send({ mode: "FORK", capabilityChanges: [{ capabilityId: "NOPE", available: true }] });
    expect(bad.status).toBe(400);

    const { body: source } = await createSimDecision();
    const badPolicy = await request(app)
      .post(`/api/v1/decisions/${source.decisionId}/replays`)
      .send({ mode: "EXACT", policyVersion: "99.9.9" });
    expect(badPolicy.status).toBe(404);
  });

  it("supports a policy-version replay against the same immutable bundle", async () => {
    const { body: source } = await createSimDecision();
    const res = await request(app)
      .post(`/api/v1/decisions/${source.decisionId}/replays`)
      .send({ mode: "EXACT", policyVersion: "1.0.0" });
    expect(res.status).toBe(201);
    expect(res.body.policyVersion).toBe("1.0.0");
  });

  it("exposes the produced decision through GET /api/v1/replays/:replayId", async () => {
    const { body: source } = await createSimDecision();
    const replay = await request(app)
      .post(`/api/v1/decisions/${source.decisionId}/replays`)
      .send({ mode: "EXACT" });
    const res = await request(app).get(`/api/v1/replays/${replay.body.replayId}`);
    expect(res.status).toBe(200);
    expect(res.body.replay.sourceDecisionId).toBe(source.decisionId);
    expect(res.body.decision.decisionId).toBe(replay.body.producedDecisionId);
  });

  it("forking the capability-constrained scenario onto a passkey enables selection", async () => {
    const res = await request(app)
      .post("/api/v1/decisions")
      .send(constrainedCapabilityScenario.build("ct_replay_con"));
    const { body: source } = res;
    expect(source.action).toBe("ASSISTED_RECOVERY");

    const replay = await request(app)
      .post(`/api/v1/decisions/${source.decisionId}/replays`)
      .send({
        mode: "FORK",
        capabilityChanges: [{ capabilityId: "PASSKEY_ENROLLED", available: true }],
      });
    expect(replay.status).toBe(201);
    const produced = await request(app).get(`/api/v1/decisions/${replay.body.producedDecisionId}`);
    expect(produced.body.selectedFactorId).toBe("PASSKEY");
    expect(produced.body.action).toBe("CHALLENGE");
  });
});

describe("policy-version replay (Stretch B)", () => {
  it("replays under candidate v1.1.0: POLICY section lists the rule delta, INPUT stays empty", async () => {
    const { body: source } = await createSimDecision("ct_pp_1");
    expect(source.policy.version).toBe("1.0.0");
    expect(source.selectedFactorId).toBe("PASSKEY");

    const res = await request(app)
      .post(`/api/v1/decisions/${source.decisionId}/replays`)
      .send({ mode: "EXACT", policyVersion: "1.1.0" });
    expect(res.status).toBe(201);
    expect(res.body.policyVersion).toBe("1.1.0");

    const produced = await request(app).get(`/api/v1/decisions/${res.body.producedDecisionId}`);
    expect(produced.status).toBe(200);
    expect(produced.body.policy.version).toBe("1.1.0");
    // The candidate rule degrades CREDENTIAL_INTEGRITY, which PASSKEY requires
    // at >= TRUSTED, so the same inputs now end in assisted recovery.
    expect(produced.body.selectedFactorId).toBeNull();
    expect(produced.body.action).toBe("ASSISTED_RECOVERY");

    const diff = await request(app).get(`/api/v1/replays/${res.body.replayId}/diff`);
    expect(diff.status).toBe(200);
    expect(diff.body.identical).toBe(false);

    const sections = diff.body.sections as Array<{ section: string; changes: Array<{ path: string }> }>;
    const policySection = sections.find((s) => s.section === "POLICY");
    expect(policySection).toBeTruthy();
    const policyPaths = (policySection?.changes ?? []).map((c) => c.path);
    expect(policyPaths).toContain("policy.trustImpactRules.trust_sim_credentials");
    expect(policyPaths.every((p) => p.startsWith("policy."))).toBe(true);

    // No input changed — policy differences are never presented as input diffs.
    expect(sections.some((s) => s.section === "INPUT")).toBe(false);
    // Same evidence and threat rules: only trust/factor/selection moved.
    expect(sections.some((s) => s.section === "THREAT")).toBe(false);
    expect(sections.some((s) => s.section === "FACTOR")).toBe(true);
    expect(sections.some((s) => s.section === "SELECTION")).toBe(true);
  });

  it("fork with both evidence and policy changes keeps INPUT and POLICY sections separate", async () => {
    const { body: source } = await createSimDecision("ct_pp_2");
    const res = await request(app)
      .post(`/api/v1/decisions/${source.decisionId}/replays`)
      .send({
        mode: "FORK",
        evidenceChanges: [{ type: "RECENT_SIM_CHANGE", value: false }],
        policyVersion: "1.1.0",
      });
    expect(res.status).toBe(201);

    const diff = await request(app).get(`/api/v1/replays/${res.body.replayId}/diff`);
    expect(diff.status).toBe(200);
    const sections = diff.body.sections as Array<{ section: string; changes: Array<{ path: string }> }>;
    const inputSection = sections.find((s) => s.section === "INPUT");
    const policySection = sections.find((s) => s.section === "POLICY");
    expect(inputSection).toBeTruthy();
    expect(policySection).toBeTruthy();
    expect((policySection?.changes ?? []).every((c) => c.path.startsWith("policy."))).toBe(true);
    expect((inputSection?.changes ?? []).every((c) => c.path.startsWith("evidence."))).toBe(true);
  });
});
