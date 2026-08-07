import { describe, expect, it } from "vitest";
import {
  zAuditEvent,
  zCreateChallengeRequest,
  zCreateChallengeResponse,
  zCreateDecisionRequest,
  zCreateDecisionResponse,
  zVerifyChallengeRequest,
  zVerifyChallengeResponse,
} from "../src/index.js";

/* Shared valid fixtures -------------------------------------------------- */

const validDecisionRequest = {
  userId: "user_demo_01",
  transaction: {
    clientTransactionId: "txn_client_001",
    amountMinor: 5000000,
    currency: "INR",
    payeeId: "payee_new_77",
    payeeIsKnown: false,
  },
  session: {
    sessionId: "sess_9f3a",
    ageSeconds: 120,
    failedLoginCount: 0,
    ipAddress: "203.0.113.7",
    asn: "AS14061",
    country: "IN",
  },
  device: {
    deviceId: "dev_new_42",
    trusted: false,
    firstSeen: true,
    browserFingerprint: "fp-a1b2c3",
  },
  signals: {
    recentSimChange: true,
    geoDistanceFromLastLoginKm: 420.5,
    phishingRelayIndicator: false,
  },
};

const validDecisionResponse = {
  decisionId: "dec_0001",
  transactionId: "txn_0001",
  policyVersion: "2026.08.0",
  risk: { level: "HIGH", reasons: ["high_value_amount", "recent_sim_change"] },
  threat: {
    type: "SIM_CHANNEL_COMPROMISE",
    support: "HIGH",
    evidence: ["recent_sim_change", "first_seen_device"],
  },
  factors: [
    {
      factor: "PASSKEY",
      status: "ALLOWED",
      reasonCode: "factor_eligible",
      reason: "Enrolled and above required assurance.",
    },
    {
      factor: "SMS_OTP",
      status: "BLOCKED",
      reasonCode: "sim_channel_compromise",
      reason: "SMS channel is not trusted under this hypothesis.",
    },
  ],
  allowedFactors: ["PASSKEY"],
  blockedFactors: ["SMS_OTP"],
  selectedFactor: "PASSKEY",
  action: "ALLOW_WITH_FACTOR",
  createdAt: "2026-08-07T12:00:00.000Z",
};

describe("CreateDecisionRequest", () => {
  it("accepts a valid SIM-swap request", () => {
    expect(zCreateDecisionRequest.safeParse(validDecisionRequest).success).toBe(
      true
    );
  });

  it("accepts null signal values (unknown signal)", () => {
    const payload = {
      ...validDecisionRequest,
      signals: {
        recentSimChange: null,
        geoDistanceFromLastLoginKm: null,
        phishingRelayIndicator: false,
      },
    };
    expect(zCreateDecisionRequest.safeParse(payload).success).toBe(true);
  });

  it("rejects a non-INR currency", () => {
    const payload = {
      ...validDecisionRequest,
      transaction: { ...validDecisionRequest.transaction, currency: "USD" },
    };
    const result = zCreateDecisionRequest.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it("rejects a fractional or negative amountMinor (money is integer minor units)", () => {
    for (const amountMinor of [10.5, -100]) {
      const payload = {
        ...validDecisionRequest,
        transaction: { ...validDecisionRequest.transaction, amountMinor },
      };
      expect(zCreateDecisionRequest.safeParse(payload).success).toBe(false);
    }
  });

  it("rejects missing phishingRelayIndicator", () => {
    const { phishingRelayIndicator: _omitted, ...signals } =
      validDecisionRequest.signals;
    const payload = { ...validDecisionRequest, signals };
    expect(zCreateDecisionRequest.safeParse(payload).success).toBe(false);
  });

  it("rejects a string recentSimChange", () => {
    const payload = {
      ...validDecisionRequest,
      signals: {
        ...validDecisionRequest.signals,
        recentSimChange: "yes",
      },
    };
    expect(zCreateDecisionRequest.safeParse(payload).success).toBe(false);
  });

  it("rejects an unknown factor id inside the nested transaction", () => {
    const payload = structuredClone(validDecisionRequest);
    payload.transaction.clientTransactionId = "";
    expect(zCreateDecisionRequest.safeParse(payload).success).toBe(false);
  });
});

describe("CreateDecisionResponse", () => {
  it("accepts a valid full decision response", () => {
    expect(zCreateDecisionResponse.safeParse(validDecisionResponse).success).toBe(
      true
    );
  });

  it("accepts assisted-recovery response with null selected factor", () => {
    const payload = {
      ...validDecisionResponse,
      selectedFactor: null,
      action: "REFER_TO_ASSISTED_RECOVERY",
      allowedFactors: [],
    };
    expect(zCreateDecisionResponse.safeParse(payload).success).toBe(true);
  });

  it("rejects an unknown factor status", () => {
    const payload = structuredClone(validDecisionResponse);
    payload.factors[0].status = "MAYBE";
    expect(zCreateDecisionResponse.safeParse(payload).success).toBe(false);
  });

  it("rejects an unknown risk level", () => {
    const payload = { ...validDecisionResponse, risk: { ...validDecisionResponse.risk, level: "CRITICAL" } };
    expect(zCreateDecisionResponse.safeParse(payload).success).toBe(false);
  });
});

describe("Challenge contracts", () => {
  it("accepts a valid challenge creation request", () => {
    expect(
      zCreateChallengeRequest.safeParse({ decisionId: "dec_0001", factor: "PASSKEY" }).success
    ).toBe(true);
  });

  it("rejects an unknown factor for challenge creation", () => {
    expect(
      zCreateChallengeRequest.safeParse({ decisionId: "dec_0001", factor: "TOTP" }).success
    ).toBe(false);
  });

  it("accepts a simulated challenge response", () => {
    expect(
      zCreateChallengeResponse.safeParse({
        challengeId: "ch_0001",
        factor: "PASSKEY",
        mode: "SIMULATED",
        expiresAt: "2026-08-07T12:05:00.000Z",
      }).success
    ).toBe(true);
  });

  it("rejects a challenge response without expiry", () => {
    expect(
      zCreateChallengeResponse.safeParse({
        challengeId: "ch_0001",
        factor: "PASSKEY",
        mode: "SIMULATED",
      }).success
    ).toBe(false);
  });

  it("accepts a valid verification request", () => {
    expect(
      zVerifyChallengeRequest.safeParse({ challengeId: "ch_0001", response: { ok: true } }).success
    ).toBe(true);
  });

  it("rejects a verification request without challengeId", () => {
    expect(zVerifyChallengeRequest.safeParse({ response: {} }).success).toBe(false);
  });

  it("accepts an authorized verification response", () => {
    expect(
      zVerifyChallengeResponse.safeParse({
        challengeId: "ch_0001",
        verified: true,
        transactionStatus: "AUTHORIZED",
      }).success
    ).toBe(true);
  });

  it("rejects an unknown transaction status", () => {
    expect(
      zVerifyChallengeResponse.safeParse({
        challengeId: "ch_0001",
        verified: true,
        transactionStatus: "PENDING",
      }).success
    ).toBe(false);
  });
});

describe("Audit event contract", () => {
  it("accepts a valid audit event", () => {
    expect(
      zAuditEvent.safeParse({
        id: "aud_0001",
        decisionId: "dec_0001",
        eventType: "FACTOR_BLOCKED",
        reasonCode: "sim_channel_compromise",
        details: { factor: "SMS_OTP" },
        createdAt: "2026-08-07T12:00:00.100Z",
      }).success
    ).toBe(true);
  });

  it("rejects an unknown event type", () => {
    expect(
      zAuditEvent.safeParse({
        id: "aud_0001",
        decisionId: "dec_0001",
        eventType: "EXPLODED",
        reasonCode: "x",
        details: {},
        createdAt: "2026-08-07T12:00:00.100Z",
      }).success
    ).toBe(false);
  });
});
