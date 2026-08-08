/**
 * Verified remediation tests (EXECUTION_new2.md Phase 7).
 *
 * - Remediation candidates derive from failed requirements (capability enable
 *   or evidence flip) — never templated promises.
 * - Every claim ("would become eligible", "would be selected") is verified by
 *   replaying the decision under the changed inputs.
 * - Multi-failure factors do not receive misleading single-cause claims.
 */
import { describe, expect, it } from "vitest";
import {
  deriveRemediationCandidates,
  evaluateDecision,
  normalizeEvidence,
  verifyFactorRemediation,
  type RawEvidence,
} from "@mfa/decision-core";
import { DEMO_POLICY_BUNDLE } from "@mfa/policy-bundles";
import { constrainedCapabilityScenario, simSwapScenario } from "@mfa/demo-data";
import type { CapabilityState, EvidenceItem, FactorEvaluation } from "@mfa/contracts";

const NOW = "2026-08-07T08:00:00.000Z";

const AARAV_CAPS: CapabilityState[] = [
  { capabilityId: "PASSKEY_ENROLLED", available: true },
  { capabilityId: "WEBAUTHN_SUPPORTED", available: true },
  { capabilityId: "NETWORK_AVAILABLE", available: true },
  { capabilityId: "TOTP_SEED", available: false },
];

const PRIYA_CAPS: CapabilityState[] = [
  { capabilityId: "PASSKEY_ENROLLED", available: false },
  { capabilityId: "WEBAUTHN_SUPPORTED", available: true },
  { capabilityId: "NETWORK_AVAILABLE", available: true },
  { capabilityId: "TOTP_SEED", available: false },
];

function evidenceFromOverrides(overrides: { type: string; value: RawEvidence["value"] }[]): EvidenceItem[] {
  const raw: RawEvidence[] = overrides.map((o) => ({
    type: o.type as RawEvidence["type"],
    value: o.value,
    providerId: "demo_override",
    providerType: "demo",
    observedAt: NOW,
    validUntil: null,
    synthetic: true,
    quality: "CONFIRMED",
  }));
  return normalizeEvidence(raw, NOW);
}

function factorDef(factorId: string) {
  const def = DEMO_POLICY_BUNDLE.factorDefinitions.find((f) => f.id === factorId);
  if (!def) throw new Error(`factor ${factorId} not in demo policy`);
  return def;
}

function evaluation(factorId: string, evidence: EvidenceItem[], caps: CapabilityState[]): FactorEvaluation {
  const output = evaluateDecision({ evidence, capabilities: caps, policy: DEMO_POLICY_BUNDLE });
  const ev = output.factors.find((f) => f.factorId === factorId);
  if (!ev) throw new Error(`no evaluation for ${factorId}`);
  return ev;
}

describe("deriveRemediationCandidates", () => {
  it("derives a capability-enable candidate for an UNAVAILABLE factor (passkey)", () => {
    const evidence = evidenceFromOverrides(constrainedCapabilityScenario.build("ct").evidenceOverrides ?? []);
    const ev = evaluation("PASSKEY", evidence, PRIYA_CAPS);
    const candidates = deriveRemediationCandidates({
      factorId: "PASSKEY",
      factor: factorDef("PASSKEY"),
      factorEvaluation: ev,
      evidence,
      capabilities: PRIYA_CAPS,
      policy: DEMO_POLICY_BUNDLE,
      evaluatedAt: NOW,
      selectedFactorId: null,
      trust: evaluateDecision({ evidence, capabilities: PRIYA_CAPS, policy: DEMO_POLICY_BUNDLE }).trust,
    });
    expect(candidates).toContainEqual({
      capabilityChanges: [{ capabilityId: "PASSKEY_ENROLLED", available: true }],
    });
  });

  it("derives an evidence-flip candidate for a TRUST-blocked factor (SMS OTP)", () => {
    const evidence = evidenceFromOverrides(simSwapScenario.build("ct").evidenceOverrides ?? []);
    const ev = evaluation("SMS_OTP", evidence, AARAV_CAPS);
    const candidates = deriveRemediationCandidates({
      factorId: "SMS_OTP",
      factor: factorDef("SMS_OTP"),
      factorEvaluation: ev,
      evidence,
      capabilities: AARAV_CAPS,
      policy: DEMO_POLICY_BUNDLE,
      evaluatedAt: NOW,
      selectedFactorId: "PASSKEY",
      trust: evaluateDecision({ evidence, capabilities: AARAV_CAPS, policy: DEMO_POLICY_BUNDLE }).trust,
    });
    // The SIM-change signal drove SIM_OWNERSHIP distrusted; flipping it is a candidate.
    expect(candidates.some((c) => c.evidenceChanges?.some((e) => e.type === "RECENT_SIM_CHANGE" && e.value === false))).toBe(true);
  });
});

describe("verifyFactorRemediation", () => {
  it("VERIFIED_SELECTED: enrolling a passkey makes it eligible and selected", () => {
    const evidence = evidenceFromOverrides(constrainedCapabilityScenario.build("ct").evidenceOverrides ?? []);
    const ev = evaluation("PASSKEY", evidence, PRIYA_CAPS);
    const result = verifyFactorRemediation({
      factorId: "PASSKEY",
      factor: factorDef("PASSKEY"),
      factorEvaluation: ev,
      evidence,
      capabilities: PRIYA_CAPS,
      policy: DEMO_POLICY_BUNDLE,
      evaluatedAt: NOW,
      selectedFactorId: null,
      trust: evaluateDecision({ evidence, capabilities: PRIYA_CAPS, policy: DEMO_POLICY_BUNDLE }).trust,
    });
    expect(result.status).toBe("VERIFIED_SELECTED");
    expect(result.changeSets.length).toBeGreaterThan(0);
    expect(result.changeSets[0]).toEqual({
      capabilityChanges: [{ capabilityId: "PASSKEY_ENROLLED", available: true }],
    });
  });

  it("VERIFIED_ELIGIBLE: TOTP becomes eligible when its seed capability is enabled (but is not selected)", () => {
    const evidence = evidenceFromOverrides(simSwapScenario.build("ct").evidenceOverrides ?? []);
    const ev = evaluation("TOTP", evidence, AARAV_CAPS);
    expect(ev.status).toBe("UNAVAILABLE"); // TOTP_SEED is false for both demo users
    const result = verifyFactorRemediation({
      factorId: "TOTP",
      factor: factorDef("TOTP"),
      factorEvaluation: ev,
      evidence,
      capabilities: AARAV_CAPS,
      policy: DEMO_POLICY_BUNDLE,
      evaluatedAt: NOW,
      selectedFactorId: "PASSKEY",
      trust: evaluateDecision({ evidence, capabilities: AARAV_CAPS, policy: DEMO_POLICY_BUNDLE }).trust,
    });
    expect(result.status).toBe("VERIFIED_ELIGIBLE");
    expect(result.changeSets).toContainEqual({
      capabilityChanges: [{ capabilityId: "TOTP_SEED", available: true }],
    });
  });

  it("REMAINS_INELIGIBLE: SMS OTP stays blocked when only the primary SIM signal is removed", () => {
    // Flipping RECENT_SIM_CHANGE alone leaves MODERATE threat support (four
    // supporting signals remain), so SIM_OWNERSHIP stays DISTRUSTED. The
    // engine must NOT emit a misleading single-cause "would become eligible".
    const evidence = evidenceFromOverrides(simSwapScenario.build("ct").evidenceOverrides ?? []);
    const ev = evaluation("SMS_OTP", evidence, AARAV_CAPS);
    const result = verifyFactorRemediation({
      factorId: "SMS_OTP",
      factor: factorDef("SMS_OTP"),
      factorEvaluation: ev,
      evidence,
      capabilities: AARAV_CAPS,
      policy: DEMO_POLICY_BUNDLE,
      evaluatedAt: NOW,
      selectedFactorId: "PASSKEY",
      trust: evaluateDecision({ evidence, capabilities: AARAV_CAPS, policy: DEMO_POLICY_BUNDLE }).trust,
    });
    expect(result.status).toBe("REMAINS_INELIGIBLE");
    expect(result.changeSets).toEqual([]);
    expect(result.explanationCode).toBe("remains_ineligible");
  });

  it("multi-condition: a factor failing on two capabilities verifies only via the combined set", () => {
    // Force WEBAUTHN_SUPPORTED off too: passkey needs both capabilities.
    const caps: CapabilityState[] = PRIYA_CAPS.map((c) =>
      c.capabilityId === "WEBAUTHN_SUPPORTED" ? { ...c, available: false } : c
    );
    const evidence = evidenceFromOverrides(constrainedCapabilityScenario.build("ct").evidenceOverrides ?? []);
    const ev = evaluation("PASSKEY", evidence, caps);
    expect(ev.status).toBe("UNAVAILABLE");
    expect(ev.failedRequirements.filter((r) => r.kind === "CAPABILITY").length).toBe(2);

    const result = verifyFactorRemediation({
      factorId: "PASSKEY",
      factor: factorDef("PASSKEY"),
      factorEvaluation: ev,
      evidence,
      capabilities: caps,
      policy: DEMO_POLICY_BUNDLE,
      evaluatedAt: NOW,
      selectedFactorId: null,
      trust: evaluateDecision({ evidence, capabilities: caps, policy: DEMO_POLICY_BUNDLE }).trust,
    });
    expect(result.status).toBe("VERIFIED_SELECTED");
    const combined = result.changeSets.find(
      (s) => (s.capabilityChanges?.length ?? 0) === 2
    );
    expect(combined).toBeDefined();
  });

  it("already-eligible factors report without change sets", () => {
    const evidence = evidenceFromOverrides(simSwapScenario.build("ct").evidenceOverrides ?? []);
    const ev = evaluation("PASSKEY", evidence, AARAV_CAPS);
    const result = verifyFactorRemediation({
      factorId: "PASSKEY",
      factor: factorDef("PASSKEY"),
      factorEvaluation: ev,
      evidence,
      capabilities: AARAV_CAPS,
      policy: DEMO_POLICY_BUNDLE,
      evaluatedAt: NOW,
      selectedFactorId: "PASSKEY",
      trust: evaluateDecision({ evidence, capabilities: AARAV_CAPS, policy: DEMO_POLICY_BUNDLE }).trust,
    });
    expect(result.status).toBe("VERIFIED_SELECTED");
    expect(result.changeSets).toEqual([]);
    expect(result.explanationCode).toBe("already_eligible");
  });
});
