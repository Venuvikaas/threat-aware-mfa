/**
 * Decision API tests (docs/EXECUTION.md Phase 3 exit gate):
 * SIM-swap blocks SMS, phishing returns its own reasons, unenrolled passkey
 * yields assisted recovery, decisions are retrievable, audits are ordered,
 * and duplicate client transaction ids are rejected.
 */
import { describe, expect, it, beforeEach } from "vitest";
import request from "supertest";
import { fileURLToPath } from "node:url";
import { createApp } from "../src/app.js";
import { openDatabase, runMigrations, type Db } from "../src/db/connection.js";
import type { CreateDecisionRequest } from "@mfa/contracts";

const migrationsDir = fileURLToPath(new URL("../src/db/migrations", import.meta.url));

let db: Db;
let api: ReturnType<typeof createApp>;

beforeEach(() => {
  db = openDatabase(":memory:");
  runMigrations(db, migrationsDir);
  api = createApp({ db, demoMode: true });
});

function simSwapRequest(clientTransactionId = "txn_demo_sim_001"): CreateDecisionRequest {
  return {
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
      browserFingerprint: "fp-unregistered-mobile-42c1",
    },
    signals: {
      recentSimChange: true,
      geoDistanceFromLastLoginKm: null,
      phishingRelayIndicator: false,
    },
  };
}

function phishingRequest(clientTransactionId = "txn_demo_phish_001"): CreateDecisionRequest {
  return {
    userId: "user_demo_01",
    transaction: {
      clientTransactionId,
      amountMinor: 5_000_000,
      currency: "INR",
      payeeId: "payee_new_88",
      payeeIsKnown: false,
    },
    session: {
      sessionId: "sess_unusual_02",
      ageSeconds: 60,
      failedLoginCount: 2,
      ipAddress: "203.0.113.9",
      asn: "AS14061",
      country: "IN",
    },
    device: {
      deviceId: "dev_trusted_01",
      trusted: true,
      firstSeen: false,
      browserFingerprint: "fp-home-chrome-win-7a9f",
    },
    signals: {
      recentSimChange: null,
      geoDistanceFromLastLoginKm: null,
      phishingRelayIndicator: true,
    },
  };
}

describe("POST /api/v1/decisions — hero scenarios", () => {
  it("SIM-swap request blocks SMS OTP and allows the passkey", async () => {
    const res = await request(api).post("/api/v1/decisions").send(simSwapRequest());
    expect(res.status).toBe(201);

    const body = res.body;
    expect(body.risk.level).toBe("HIGH");
    expect(body.threat.type).toBe("SIM_CHANNEL_COMPROMISE");
    expect(body.threat.support).toBe("HIGH");
    expect(body.threat.evidence).toContain("recent_sim_change");

    const sms = body.factors.find((f: { factor: string }) => f.factor === "SMS_OTP");
    expect(sms.status).toBe("BLOCKED");
    expect(sms.reasonCode).toBe("sms_channel_untrusted");

    const passkey = body.factors.find((f: { factor: string }) => f.factor === "PASSKEY");
    expect(passkey.status).toBe("ALLOWED");

    expect(body.allowedFactors).toEqual(["PASSKEY"]);
    expect(body.blockedFactors).toEqual(["SMS_OTP"]);
    expect(body.selectedFactor).toBe("PASSKEY");
    expect(body.action).toBe("ALLOW_WITH_FACTOR");
    expect(body.policyVersion).toMatch(/^\d{4}\.\d{2}\.\d$/);
  });

  it("phishing request returns phishing-specific reasons", async () => {
    const res = await request(api).post("/api/v1/decisions").send(phishingRequest());
    expect(res.status).toBe(201);

    const body = res.body;
    expect(body.threat.type).toBe("PHISHING");
    expect(body.threat.support).toBe("HIGH");
    expect(body.threat.evidence).toContain("phishing_relay_indicator");

    const sms = body.factors.find((f: { factor: string }) => f.factor === "SMS_OTP");
    expect(sms.status).toBe("BLOCKED");
    expect(sms.reasonCode).toBe("factor_relayable");
    expect(body.selectedFactor).toBe("PASSKEY");
  });

  it("unenrolled passkey produces assisted recovery instead of unsafe SMS fallback", async () => {
    const req = simSwapRequest("txn_demo_recovery_001");
    req.userId = "user_demo_02"; // passkey not enrolled

    const res = await request(api).post("/api/v1/decisions").send(req);
    expect(res.status).toBe(201);

    const body = res.body;
    expect(body.factors.find((f: { factor: string }) => f.factor === "PASSKEY").status).toBe(
      "UNAVAILABLE"
    );
    expect(body.factors.find((f: { factor: string }) => f.factor === "SMS_OTP").status).toBe(
      "BLOCKED"
    );
    expect(body.selectedFactor).toBeNull();
    expect(body.allowedFactors).toEqual([]);
    expect(body.action).toBe("REFER_TO_ASSISTED_RECOVERY");
  });

  it("equal-risk hero scenarios produce different threat traces", async () => {
    const sim = (await request(api).post("/api/v1/decisions").send(simSwapRequest())).body;
    const phish = (await request(api).post("/api/v1/decisions").send(phishingRequest())).body;
    expect(sim.risk.level).toBe(phish.risk.level);
    expect(sim.threat.type).not.toBe(phish.threat.type);
    expect(
      sim.factors.find((f: { factor: string }) => f.factor === "SMS_OTP").reasonCode
    ).not.toBe(
      phish.factors.find((f: { factor: string }) => f.factor === "SMS_OTP").reasonCode
    );
  });
});

describe("GET decision + audit", () => {
  it("retrieves a persisted decision identical to the create response", async () => {
    const created = (await request(api).post("/api/v1/decisions").send(simSwapRequest())).body;
    const res = await request(api).get(`/api/v1/decisions/${created.decisionId}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(created);
  });

  it("returns 404 for an unknown decision", async () => {
    const res = await request(api).get("/api/v1/decisions/dec_missing");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("returns the audit timeline in stable insertion order", async () => {
    const created = (await request(api).post("/api/v1/decisions").send(simSwapRequest())).body;
    const res = await request(api).get(`/api/v1/decisions/${created.decisionId}/audit`);
    expect(res.status).toBe(200);
    const types = res.body.map((e: { eventType: string }) => e.eventType);
    expect(types[0]).toBe("DECISION_CREATED");
    expect(types).toContain("FACTOR_BLOCKED");
    expect(types[types.length - 1]).toBe("FACTOR_SELECTED");
    for (const event of res.body) {
      expect(typeof event.id).toBe("string");
      expect(event.decisionId).toBe(created.decisionId);
      expect(typeof event.reasonCode).toBe("string");
      expect(event.details).toBeTypeOf("object");
    }
  });

  it("records RECOVERY_REQUIRED as the final audit event for recovery", async () => {
    const req = simSwapRequest("txn_demo_recovery_audit");
    req.userId = "user_demo_02";
    const created = (await request(api).post("/api/v1/decisions").send(req)).body;
    const res = await request(api).get(`/api/v1/decisions/${created.decisionId}/audit`);
    const types = res.body.map((e: { eventType: string }) => e.eventType);
    expect(types[types.length - 1]).toBe("RECOVERY_REQUIRED");
  });
});

describe("idempotency and errors", () => {
  it("rejects a repeated client transaction id with CONFLICT", async () => {
    await request(api).post("/api/v1/decisions").send(simSwapRequest("txn_dup_001"));
    const res = await request(api)
      .post("/api/v1/decisions")
      .send(simSwapRequest("txn_dup_001"));
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("CONFLICT");
    expect(res.body.error.details.decisionId).toBeTruthy();
  });

  it("rejects an unknown user with 404", async () => {
    const req = simSwapRequest("txn_unknown_user");
    req.userId = "user_missing";
    const res = await request(api).post("/api/v1/decisions").send(req);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("rejects an invalid payload with VALIDATION_ERROR", async () => {
    const req = simSwapRequest("txn_bad_payload");
    const res = await request(api)
      .post("/api/v1/decisions")
      .send({
        ...req,
        transaction: { ...req.transaction, currency: "USD" },
      });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });
});
