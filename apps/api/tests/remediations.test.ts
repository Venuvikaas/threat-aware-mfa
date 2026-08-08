/**
 * Verified remediation API coverage (EXECUTION_new2.md Phase 7 exit gate).
 *
 * - PASSKEY remediation for the constrained-capability user verifies as
 *   wouldBeSelected (enroll a passkey -> eligible AND selected).
 * - TOTP remediation verifies as wouldBecomeEligible (seed enabled, but
 *   another factor still wins selection).
 * - Factors that remain blocked report REMAINS_INELIGIBLE with no change
 *   sets and precise language (no misleading single-cause claims).
 * - Unknown decisions / factors fail cleanly.
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

async function createDecision(reqBody: ReturnType<typeof simSwapScenario.build>, clientTransactionId: string) {
  const res = await request(app).post("/api/v1/decisions").send({ ...reqBody, clientTransactionId });
  return { status: res.status, body: res.body as any };
}

describe("POST /api/v1/decisions/:decisionId/remediations/:factorId/verify", () => {
  it("verifies passkey remediation as would-be-selected for the constrained user", async () => {
    const { body: decision } = await createDecision(
      constrainedCapabilityScenario.build("ct_rem_con"),
      "ct_rem_con"
    );
    const passkey = decision.factors.find((f: any) => f.factorId === "PASSKEY");
    expect(passkey.status).toBe("UNAVAILABLE");

    const res = await request(app)
      .post(`/api/v1/decisions/${decision.decisionId}/remediations/PASSKEY/verify`)
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.verified).toBe(true);
    expect(res.body.wouldBecomeEligible).toBe(true);
    expect(res.body.wouldBeSelected).toBe(true);
    expect(res.body.changeSets).toContainEqual({
      capabilityChanges: [{ capabilityId: "PASSKEY_ENROLLED", available: true }],
    });
  });

  it("verifies TOTP remediation as would-become-eligible (but not selected)", async () => {
    const { body: decision } = await createDecision(simSwapScenario.build("ct_rem_sim"), "ct_rem_sim");
    const totp = decision.factors.find((f: any) => f.factorId === "TOTP");
    expect(totp.status).toBe("UNAVAILABLE");

    const res = await request(app)
      .post(`/api/v1/decisions/${decision.decisionId}/remediations/TOTP/verify`)
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.verified).toBe(true);
    expect(res.body.wouldBecomeEligible).toBe(true);
    expect(res.body.wouldBeSelected).toBe(false);
    expect(res.body.changeSets).toContainEqual({
      capabilityChanges: [{ capabilityId: "TOTP_SEED", available: true }],
    });
  });

  it("reports REMAINS_INELIGIBLE with precise language when no change verifies", async () => {
    // SMS OTP stays blocked under the SIM scenario: removing the primary
    // signal alone still leaves MODERATE threat support, so the engine must
    // not emit a misleading single-cause "would become eligible".
    const { body: decision } = await createDecision(simSwapScenario.build("ct_rem_sms"), "ct_rem_sms");
    const res = await request(app)
      .post(`/api/v1/decisions/${decision.decisionId}/remediations/SMS_OTP/verify`)
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.verified).toBe(false);
    expect(res.body.wouldBecomeEligible).toBe(false);
    expect(res.body.wouldBeSelected).toBe(false);
    expect(res.body.changeSets).toEqual([]);
  });

  it("returns 404 for unknown decision or factor", async () => {
    const { body: decision } = await createDecision(simSwapScenario.build("ct_rem_404"), "ct_rem_404");
    const ghost = await request(app)
      .post(`/api/v1/decisions/dec_ghost/remediations/PASSKEY/verify`)
      .send({});
    expect(ghost.status).toBe(404);

    const badFactor = await request(app)
      .post(`/api/v1/decisions/${decision.decisionId}/remediations/SPELLING/verify`)
      .send({});
    expect(badFactor.status).toBe(400);
  });

  it("persists the verified remediation record", async () => {
    const { body: decision } = await createDecision(
      constrainedCapabilityScenario.build("ct_rem_persist"),
      "ct_rem_persist"
    );
    await request(app)
      .post(`/api/v1/decisions/${decision.decisionId}/remediations/PASSKEY/verify`)
      .send({});
    const row = db
      .prepare("SELECT factor_id, status FROM verified_remediations WHERE decision_id = ?")
      .all(decision.decisionId) as { factor_id: string; status: string }[];
    expect(row.length).toBe(1);
    expect(row[0].status).toBe("VERIFIED_SELECTED");
  });
});
