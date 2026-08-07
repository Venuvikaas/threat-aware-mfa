/**
 * Generic factor-eligibility coverage (EXECUTION_new2.md Phase 1).
 *
 * - Trust failure -> INELIGIBLE with a typed failed requirement.
 * - Capability failure (trust acceptable) -> UNAVAILABLE.
 * - Assurance below the required minimum -> INELIGIBLE.
 * - ELIGIBLE only when every gate passes.
 * - The evaluator is generic: the SAME code path handles SMS_OTP, PASSKEY,
 *   TOTP, and PIN; outcomes differ only via the declarative catalog.
 */
import { describe, expect, it } from "vitest";
import { assessThreats, assessTrust, evaluateFactorRequirements, evaluateFactors, normalizeEvidence } from "@mfa/decision-core";
import { DEMO_POLICY_BUNDLE } from "@mfa/policy-bundles";
import type { CapabilityState, EvidenceItem, FactorDefinition, TrustRequirement } from "@mfa/contracts";

const NOW = "2026-08-07T08:00:00.000Z";

function ev(
  type: EvidenceItem["type"],
  value: EvidenceItem["value"],
  _index: number
): EvidenceItem {
  return normalizeEvidence(
    [
      {
        type,
        value,
        providerId: "test",
        providerType: "test",
        observedAt: NOW,
        validUntil: null,
        synthetic: true,
        quality: "CONFIRMED",
      },
    ],
    NOW
  )[0];
}

function caps(overrides: Partial<Record<CapabilityState["capabilityId"], boolean>> = {}): CapabilityState[] {
  const base: CapabilityState[] = [
    { capabilityId: "PASSKEY_ENROLLED", available: true },
    { capabilityId: "WEBAUTHN_SUPPORTED", available: true },
    { capabilityId: "NETWORK_AVAILABLE", available: true },
    { capabilityId: "TOTP_SEED", available: false },
  ];
  return base.map((c) => ({
    capabilityId: c.capabilityId,
    available: overrides[c.capabilityId] ?? c.available,
  }));
}

function evaluate(evidence: EvidenceItem[], capabilityStates: CapabilityState[], requiredAssurance: "AAL1" | "AAL2" | "AAL3" = "AAL2") {
  const threats = assessThreats(evidence, DEMO_POLICY_BUNDLE);
  const trust = assessTrust(threats, evidence, DEMO_POLICY_BUNDLE);
  return evaluateFactors(DEMO_POLICY_BUNDLE.factorDefinitions, {
    trust,
    capabilities: capabilityStates,
    requiredAssurance,
    evidence,
  });
}

describe("evaluateFactors", () => {
  it("makes SMS OTP INELIGIBLE when SIM ownership is distrusted", () => {
    const results = evaluate([ev("RECENT_SIM_CHANGE", true, 0), ev("FAILED_LOGIN_BURST", true, 1)], caps());
    const sms = results.find((f) => f.factorId === "SMS_OTP");
    expect(sms?.status).toBe("INELIGIBLE");
    const trustFailure = sms?.failedRequirements.find((r) => r.kind === "TRUST");
    expect(trustFailure?.requirementId).toBe("SMS_OTP__SIM_OWNERSHIP");
    expect(trustFailure?.actualState).toBe("DISTRUSTED");
    expect(trustFailure?.requiredState).toBe("TRUSTED");
    expect(trustFailure?.ruleIds).toContain("trust_sim_ownership");
  });

  it("makes PASSKEY UNAVAILABLE (not ineligible) when unenrolled", () => {
    const results = evaluate([ev("NEW_PAYEE", true, 0)], caps({ PASSKEY_ENROLLED: false }));
    const passkey = results.find((f) => f.factorId === "PASSKEY");
    expect(passkey?.status).toBe("UNAVAILABLE");
    expect(passkey?.failedRequirements[0].kind).toBe("CAPABILITY");
  });

  it("makes TOTP UNAVAILABLE when the seed is missing", () => {
    const results = evaluate([ev("NEW_PAYEE", true, 0)], caps({ TOTP_SEED: false }));
    const totp = results.find((f) => f.factorId === "TOTP");
    expect(totp?.status).toBe("UNAVAILABLE");
  });

  it("enforces the assurance threshold as an eligibility gate", () => {
    // HIGH risk requires AAL2; SMS_OTP is AAL1 -> INELIGIBLE even with every
    // trust domain trusted.
    const results = evaluate([ev("NEW_PAYEE", true, 0)], caps(), "AAL2");
    const sms = results.find((f) => f.factorId === "SMS_OTP");
    expect(sms?.status).toBe("INELIGIBLE");
    expect(sms?.assuranceSatisfied).toBe(false);
    expect(sms?.failedRequirements.some((r) => r.kind === "ASSURANCE")).toBe(true);
  });

  it("selects passkey under a clean SIM-swap chain", () => {
    const results = evaluate([ev("RECENT_SIM_CHANGE", true, 0), ev("HIGH_VALUE_TRANSACTION", true, 1)], caps());
    const passkey = results.find((f) => f.factorId === "PASSKEY");
    const sms = results.find((f) => f.factorId === "SMS_OTP");
    const pin = results.find((f) => f.factorId === "PIN");
    expect(passkey?.status).toBe("ELIGIBLE");
    expect(sms?.status).toBe("INELIGIBLE");
    // Session integrity is distrusted by the device concern -> PIN blocked.
    expect(pin?.status).toBe("INELIGIBLE");
  });

  it("is generic: same code path, different outcomes via data only", () => {
    // Prove no factor-specific branch by evaluating with a catalog where the
    // declarations are flipped: PASSKEY requires SIM_OWNERSHIP TRUSTED.
    const tamperedFactor: FactorDefinition = {
      ...DEMO_POLICY_BUNDLE.factorDefinitions.find((f) => f.id === "PASSKEY")!,
      trustRequirements: [
        { domainId: "SIM_OWNERSHIP", minimumState: "TRUSTED", rationaleCode: "tampered" } satisfies TrustRequirement,
      ],
    };
    const tampered = {
      ...DEMO_POLICY_BUNDLE,
      factorDefinitions: DEMO_POLICY_BUNDLE.factorDefinitions.map((f) => (f.id === "PASSKEY" ? tamperedFactor : f)),
    };
    const evidence = [ev("RECENT_SIM_CHANGE", true, 0)];
    const threats = assessThreats(evidence, tampered);
    const trust = assessTrust(threats, evidence, tampered);
    const results = evaluateFactors(tampered.factorDefinitions, {
      trust,
      capabilities: caps(),
      requiredAssurance: "AAL2",
      evidence,
    });
    // Without any factor-name conditional, PASSKEY now fails on SIM ownership
    // — proving the evaluator reads only declarations.
    expect(results.find((f) => f.factorId === "PASSKEY")?.status).toBe("INELIGIBLE");
  });
});

describe("evaluateFactorRequirements (single factor)", () => {
  it("returns ELIGIBLE with empty failures when all gates pass", () => {
    const sms = DEMO_POLICY_BUNDLE.factorDefinitions.find((f) => f.id === "SMS_OTP")!;
    const threats = assessThreats([ev("NEW_PAYEE", true, 0)], DEMO_POLICY_BUNDLE);
    const trust = assessTrust(threats, [ev("NEW_PAYEE", true, 0)], DEMO_POLICY_BUNDLE);
    const result = evaluateFactorRequirements({
      factor: sms,
      trust,
      capabilities: caps(),
      requiredAssurance: "AAL1",
      evidence: [ev("NEW_PAYEE", true, 0)],
    });
    expect(result.status).toBe("ELIGIBLE");
    expect(result.failedRequirements).toEqual([]);
  });
});
