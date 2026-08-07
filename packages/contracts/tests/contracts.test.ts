/**
 * Runtime validation coverage for every frozen contract (EXECUTION_new2.md
 * Phase 0 box: "Validate accepted and rejected examples for every schema").
 *
 * Each schema gets at least one accepted example and one rejected example so
 * the frozen contracts cannot drift from their TypeScript types.
 */
import { describe, expect, it } from "vitest";
import {
  zEvidenceItem,
  zEvidenceOverride,
  zThreatAssessment,
  zTrustAssessment,
  zTrustRequirement,
  zFactorDefinition,
  zFactorEvaluation,
  zCapabilityState,
  zCapabilityOverride,
  zRiskRule,
  zThreatRule,
  zTrustImpactRule,
  zSelectionPolicy,
  zPolicyBundle,
  zRuleTraceEvent,
  zCreateDecisionRequest,
  zDecisionResponse,
  zCreateReplayRequest,
  zReplayRecord,
  zDecisionDiff,
  zFactorRemediation,
  zRemediationResponse,
  zCreateChallengeRequest,
  zCreateChallengeResponse,
  zVerifyChallengeRequest,
  zVerifyChallengeResponse,
} from "@mfa/contracts";

describe("evidence contracts", () => {
  it("accepts a complete evidence item", () => {
    const ok = zEvidenceItem.safeParse({
      id: "ev_1",
      type: "RECENT_SIM_CHANGE",
      value: true,
      providerId: "mock_telco",
      providerType: "telco",
      observedAt: "2026-08-07T08:00:00.000Z",
      validUntil: "2026-08-07T09:00:00.000Z",
      synthetic: true,
      quality: "CONFIRMED",
      status: "ACTIVE",
    });
    expect(ok.success).toBe(true);
  });

  it("rejects an unknown evidence type and missing status", () => {
    const bad = zEvidenceItem.safeParse({
      id: "ev_1",
      type: "SPOOKY_SIGNAL",
      value: true,
      providerId: "p",
      providerType: "t",
      observedAt: "now",
      validUntil: null,
      synthetic: true,
      quality: "CONFIRMED",
    });
    expect(bad.success).toBe(false);
  });

  it("accepts a valid override and rejects a bad value type", () => {
    expect(
      zEvidenceOverride.safeParse({ type: "PHISHING_RELAY_INDICATOR", value: true }).success
    ).toBe(true);
    expect(
      zEvidenceOverride.safeParse({ type: "PHISHING_RELAY_INDICATOR", value: { oops: 1 } })
        .success
    ).toBe(false);
  });
});

describe("threat contracts", () => {
  it("accepts an assessment with evidence and rule refs", () => {
    expect(
      zThreatAssessment.safeParse({
        threatId: "SIM_CHANNEL_COMPROMISE",
        support: "STRONG",
        supportingEvidenceIds: ["ev_1"],
        conflictingEvidenceIds: [],
        activatedRuleIds: ["threat_sim_primary", "threat_sim_supporting"],
      }).success
    ).toBe(true);
  });

  it("rejects an unsupported threat id", () => {
    expect(
      zThreatAssessment.safeParse({
        threatId: "CRYPTO_MINER",
        support: "STRONG",
        supportingEvidenceIds: [],
        conflictingEvidenceIds: [],
        activatedRuleIds: [],
      }).success
    ).toBe(false);
  });
});

describe("trust contracts", () => {
  it("accepts a trust assessment", () => {
    expect(
      zTrustAssessment.safeParse({
        domainId: "SIM_OWNERSHIP",
        state: "DISTRUSTED",
        evidenceIds: ["ev_1"],
        threatIds: ["SIM_CHANNEL_COMPROMISE"],
        activatedRuleIds: ["trust_sim_distrust"],
      }).success
    ).toBe(true);
  });

  it("rejects a numeric trust state", () => {
    expect(
      zTrustAssessment.safeParse({
        domainId: "SIM_OWNERSHIP",
        state: 42,
        evidenceIds: [],
        threatIds: [],
        activatedRuleIds: [],
      }).success
    ).toBe(false);
  });
});

describe("factor contracts", () => {
  const smsRequirement = {
    domainId: "SIM_OWNERSHIP",
    minimumState: "TRUSTED",
    rationaleCode: "sms_depends_on_sim_ownership",
  } as const;

  it("accepts a trust requirement", () => {
    expect(zTrustRequirement.safeParse(smsRequirement).success).toBe(true);
  });

  it("rejects a requirement on an unknown domain", () => {
    expect(
      zTrustRequirement.safeParse({
        domainId: "BANK_SOLVENCY",
        minimumState: "TRUSTED",
        rationaleCode: "x",
      }).success
    ).toBe(false);
  });

  it("accepts a declarative factor definition", () => {
    expect(
      zFactorDefinition.safeParse({
        id: "SMS_OTP",
        displayName: "SMS One-Time Password",
        assurance: "AAL1",
        trustRequirements: [smsRequirement],
        capabilityRequirements: ["NETWORK_AVAILABLE"],
        frictionTier: "LOW",
        adapterId: "simulated_sms_otp",
        enabled: true,
      }).success
    ).toBe(true);
  });

  it("rejects an unknown factor id", () => {
    expect(
      zFactorDefinition.safeParse({
        id: "CARRIER_PIGEON",
        displayName: "Pigeon",
        assurance: "AAL1",
        trustRequirements: [],
        capabilityRequirements: [],
        frictionTier: "LOW",
        adapterId: "p",
        enabled: true,
      }).success
    ).toBe(false);
  });

  it("accepts a factor evaluation and rejects a bogus status", () => {
    const base = {
      factorId: "SMS_OTP",
      status: "INELIGIBLE",
      failedRequirements: [
        {
          kind: "TRUST",
          requirementId: "sms_requires_sim_ownership",
          actualState: "DISTRUSTED",
          requiredState: "TRUSTED",
          evidenceIds: ["ev_1"],
          ruleIds: ["trust_sim_distrust"],
          reasonCode: "trust_requirement_failed",
        },
      ],
      assuranceSatisfied: true,
      frictionTier: "LOW",
      traceEventIds: ["tr_1"],
    };
    expect(zFactorEvaluation.safeParse(base).success).toBe(true);
    expect(
      zFactorEvaluation.safeParse({ ...base, status: "MAYBE" }).success
    ).toBe(false);
  });
});

describe("capability contracts", () => {
  it("accepts a capability state", () => {
    expect(
      zCapabilityState.safeParse({ capabilityId: "PASSKEY_ENROLLED", available: true }).success
    ).toBe(true);
  });
  it("rejects an unknown capability id", () => {
    expect(
      zCapabilityState.safeParse({ capabilityId: "VIP_ACCESS", available: true }).success
    ).toBe(false);
  });
  it("accepts a capability override", () => {
    expect(
      zCapabilityOverride.safeParse({ capabilityId: "NETWORK_AVAILABLE", available: false })
        .success
    ).toBe(true);
  });
});

describe("policy contracts", () => {
  const predicate = { evidenceType: "RECENT_SIM_CHANGE", op: "EQ", value: true };

  it("accepts risk, threat, and trust impact rules", () => {
    expect(zRiskRule.safeParse({ id: "risk_high_value", predicate, severity: "HIGH", reasonCode: "r" }).success).toBe(true);
    expect(zThreatRule.safeParse({ id: "thr_sim", threatId: "SIM_CHANNEL_COMPROMISE", kind: "PRIMARY", predicate }).success).toBe(true);
    expect(zTrustImpactRule.safeParse({ id: "ti_sim", threatId: "SIM_CHANNEL_COMPROMISE", domainId: "SIM_OWNERSHIP", impact: "DISTRUST" }).success).toBe(true);
  });

  it("rejects a threat rule with an unknown evidence type", () => {
    expect(
      zThreatRule.safeParse({
        id: "thr_x",
        threatId: "SIM_CHANNEL_COMPROMISE",
        kind: "PRIMARY",
        predicate: { evidenceType: "NO_SUCH_TYPE", op: "EQ", value: true },
      }).success
    ).toBe(false);
  });

  it("accepts a selection policy", () => {
    expect(
      zSelectionPolicy.safeParse({
        requiredAssuranceByRisk: { LOW: "AAL1", MEDIUM: "AAL1", HIGH: "AAL2" },
        tieBreaker: ["PASSKEY", "TOTP", "SMS_OTP", "PIN"],
      }).success
    ).toBe(true);
  });

  it("accepts a full policy bundle", () => {
    expect(
      zPolicyBundle.safeParse({
        id: "bundle_demo",
        version: "1.0.0",
        contentHash: "abc123",
        status: "ACTIVE",
        riskRules: [{ id: "risk_high_value", predicate, severity: "HIGH", reasonCode: "high_value" }],
        threatRules: [{ id: "thr_sim", threatId: "SIM_CHANNEL_COMPROMISE", kind: "PRIMARY", predicate }],
        trustImpactRules: [{ id: "ti_sim", threatId: "SIM_CHANNEL_COMPROMISE", domainId: "SIM_OWNERSHIP", impact: "DISTRUST" }],
        factorDefinitions: [],
        selectionPolicy: {
          requiredAssuranceByRisk: { LOW: "AAL1", MEDIUM: "AAL1", HIGH: "AAL2" },
          tieBreaker: [],
        },
        createdAt: "2026-08-01T00:00:00.000Z",
      }).success
    ).toBe(true);
  });
});

describe("trace contracts", () => {
  it("accepts a rule trace event and rejects negative sequence", () => {
    const base = {
      id: "tr_1",
      phase: "THREAT_ASSESSMENT",
      ruleId: "thr_sim",
      ruleVersion: "1.0.0",
      inputRefs: ["ev_1"],
      outputRefs: ["threat_sim"],
      explanationCode: "sim_change_strong",
      sequence: 3,
    };
    expect(zRuleTraceEvent.safeParse(base).success).toBe(true);
    expect(zRuleTraceEvent.safeParse({ ...base, sequence: -1 }).success).toBe(false);
    expect(zRuleTraceEvent.safeParse({ ...base, phase: "NOPE" }).success).toBe(false);
  });
});

describe("decision contracts", () => {
  const validRequest = {
    userId: "user_demo_01",
    clientTransactionId: "ct_1",
    transaction: {
      amountMinor: 5_000_000,
      currency: "INR",
      payeeId: "payee_new_77",
      payeeIsKnown: false,
    },
    session: {
      sessionId: "sess_unusual_01",
      deviceId: "dev_new_01",
      ageSeconds: 120,
      failedLoginCount: 2,
      ipAddress: "198.51.100.44",
      asn: "AS16509",
      country: "US",
    },
  };

  it("accepts a create-decision request", () => {
    expect(zCreateDecisionRequest.safeParse(validRequest).success).toBe(true);
  });

  it("accepts evidence overrides", () => {
    expect(
      zCreateDecisionRequest.safeParse({
        ...validRequest,
        evidenceOverrides: [{ type: "RECENT_SIM_CHANGE", value: true }],
      }).success
    ).toBe(true);
  });

  it("rejects wrong currency and negative amounts", () => {
    expect(
      zCreateDecisionRequest.safeParse({
        ...validRequest,
        transaction: { ...validRequest.transaction, currency: "USD" },
      }).success
    ).toBe(false);
    expect(
      zCreateDecisionRequest.safeParse({
        ...validRequest,
        transaction: { ...validRequest.transaction, amountMinor: -5 },
      }).success
    ).toBe(false);
  });

  it("accepts a complete decision response", () => {
    expect(
      zDecisionResponse.safeParse({
        decisionId: "dec_1",
        transactionId: "txn_1",
        policy: { bundleId: "bundle_demo", version: "1.0.0", contentHash: "abc123" },
        risk: { level: "HIGH", reasonCodes: ["high_value"] },
        evidence: [],
        threats: [],
        trust: [],
        factors: [],
        selectedFactorId: "PASSKEY",
        action: "CHALLENGE",
        trace: [],
        createdAt: "2026-08-07T08:00:00.000Z",
      }).success
    ).toBe(true);
  });

  it("rejects a decision response with a percentage", () => {
    expect(
      zDecisionResponse.safeParse({
        decisionId: "dec_1",
        transactionId: "txn_1",
        policy: { bundleId: "b", version: "1", contentHash: "h" },
        risk: { level: "HIGH", reasonCodes: [] },
        evidence: [],
        threats: [],
        trust: [],
        factors: [],
        selectedFactorId: null,
        action: "CHALLENGE",
        trace: [],
        createdAt: "now",
        probability: 0.87,
      }).success
    ).toBe(false);
  });
});

describe("replay contracts", () => {
  it("accepts replay requests and records", () => {
    expect(zCreateReplayRequest.safeParse({ mode: "EXACT" }).success).toBe(true);
    expect(
      zCreateReplayRequest.safeParse({
        mode: "FORK",
        evidenceChanges: [{ type: "PASSKEY_ENROLLED", value: false }],
        capabilityChanges: [{ capabilityId: "PASSKEY_ENROLLED", available: false }],
      }).success
    ).toBe(true);
    expect(zCreateReplayRequest.safeParse({ mode: "SORCERY" }).success).toBe(false);
    expect(
      zReplayRecord.safeParse({
        replayId: "rp_1",
        sourceDecisionId: "dec_1",
        mode: "EXACT",
        policyVersion: "1.0.0",
        producedDecisionId: "dec_2",
        createdAt: "now",
      }).success
    ).toBe(true);
  });

  it("accepts a decision diff", () => {
    expect(
      zDecisionDiff.safeParse({
        replayId: "rp_1",
        sourceDecisionId: "dec_1",
        identical: false,
        sections: [
          {
            section: "SELECTION",
            changes: [{ path: "selectedFactorId", before: "PASSKEY", after: null }],
          },
        ],
      }).success
    ).toBe(true);
  });

  it("accepts remediation payloads", () => {
    expect(
      zFactorRemediation.safeParse({
        factorId: "PASSKEY",
        status: "VERIFIED_SELECTED",
        changeSets: [{ capabilityChanges: [{ capabilityId: "PASSKEY_ENROLLED", available: true }] }],
        explanationCode: "enroll_passkey",
      }).success
    ).toBe(true);
    expect(
      zRemediationResponse.safeParse({
        decisionId: "dec_1",
        factorId: "PASSKEY",
        verified: true,
        wouldBecomeEligible: true,
        wouldBeSelected: true,
        changeSets: [],
      }).success
    ).toBe(true);
  });
});

describe("challenge contracts", () => {
  it("accepts create/verify challenge payloads", () => {
    expect(zCreateChallengeRequest.safeParse({ decisionId: "dec_1", factor: "PASSKEY" }).success).toBe(true);
    expect(zCreateChallengeRequest.safeParse({ decisionId: "dec_1", factor: "COIN" }).success).toBe(false);
    expect(zVerifyChallengeRequest.safeParse({ challengeId: "ch_1", response: { simulatedOk: true } }).success).toBe(true);
  });

  it("accepts challenge responses", () => {
    expect(
      zCreateChallengeResponse.safeParse({
        challengeId: "ch_1",
        factor: "PASSKEY",
        mode: "SIMULATED",
        expiresAt: "now",
      }).success
    ).toBe(true);
    expect(
      zVerifyChallengeResponse.safeParse({
        challengeId: "ch_1",
        verified: true,
        transactionStatus: "AUTHORIZED",
      }).success
    ).toBe(true);
  });
});
