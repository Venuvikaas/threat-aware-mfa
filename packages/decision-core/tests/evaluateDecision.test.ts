/**
 * Full-pipeline tests (EXECUTION_new2.md Phase 1 exit gate).
 *
 * The single pure function accepts evidence, capabilities, and the policy
 * bundle and returns threats, trust, factors, selection, action, and trace.
 * Every output must be deterministic (same input -> identical output).
 */
import { describe, expect, it } from "vitest";
import { evaluateDecision, normalizeEvidence, type RawEvidence } from "@mfa/decision-core";
import { DEMO_POLICY_BUNDLE } from "@mfa/policy-bundles";
import { SIM_SWAP_SCENARIO_ID, simSwapScenario, phishingScenario, constrainedCapabilityScenario } from "@mfa/demo-data";
import type { CapabilityState, EvidenceItem } from "@mfa/contracts";

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

function evidenceFromScenario(request: ReturnType<typeof simSwapScenario.build>): EvidenceItem[] {
  const raw: RawEvidence[] = (request.evidenceOverrides ?? []).map((o) => ({
    type: o.type,
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

function run(scenario: "sim" | "phish" | "constrained") {
  const request =
    scenario === "sim"
      ? simSwapScenario.build("ct_1")
      : scenario === "phish"
        ? phishingScenario.build("ct_1")
        : constrainedCapabilityScenario.build("ct_1");
  const evidence = evidenceFromScenario(request);
  const capabilities = scenario === "constrained" ? PRIYA_CAPS : AARAV_CAPS;
  return evaluateDecision({ evidence, capabilities, policy: DEMO_POLICY_BUNDLE });
}

describe("evaluateDecision (scenarios)", () => {
  it("derives the SIM-swap chain: SMS ineligible -> passkey selected -> CHALLENGE", () => {
    const d = run("sim");
    expect(d.risk.level).toBe("HIGH");
    expect(d.threats.find((t) => t.threatId === "SIM_CHANNEL_COMPROMISE")?.support).toBe("STRONG");
    expect(d.trust.find((t) => t.domainId === "SIM_OWNERSHIP")?.state).toBe("DISTRUSTED");
    expect(d.factors.find((f) => f.factorId === "SMS_OTP")?.status).toBe("INELIGIBLE");
    expect(d.factors.find((f) => f.factorId === "PASSKEY")?.status).toBe("ELIGIBLE");
    expect(d.selectedFactorId).toBe("PASSKEY");
    expect(d.action).toBe("CHALLENGE");
  });

  it("derives the phishing chain: same risk, different trust effect", () => {
    const sim = run("sim");
    const phish = run("phish");
    // Equal risk levels…
    expect(phish.risk.level).toBe("HIGH");
    expect(sim.risk.level).toBe("HIGH");
    // …but different trust impacts: SIM ownership stays trusted under phishing.
    expect(phish.trust.find((t) => t.domainId === "SIM_OWNERSHIP")?.state).toBe("TRUSTED");
    expect(phish.trust.find((t) => t.domainId === "TELECOM_DELIVERY")?.state).toBe("DISTRUSTED");
    expect(phish.trust.find((t) => t.domainId === "USER_VERIFICATION")?.state).toBe("DEGRADED");
    // SMS blocked in both — for different failed requirements.
    const simSms = sim.factors.find((f) => f.factorId === "SMS_OTP")!;
    const phishSms = phish.factors.find((f) => f.factorId === "SMS_OTP")!;
    expect(simSms.failedRequirements.map((r) => r.requirementId)).toContain("SMS_OTP__SIM_OWNERSHIP");
    expect(phishSms.failedRequirements.map((r) => r.requirementId)).toContain("SMS_OTP__TELECOM_DELIVERY");
  });

  it("derives assisted recovery when the capability-constrained user has no passkey", () => {
    const d = run("constrained");
    expect(d.factors.find((f) => f.factorId === "PASSKEY")?.status).toBe("UNAVAILABLE");
    expect(d.selectedFactorId).toBeNull();
    expect(d.action).toBe("ASSISTED_RECOVERY");
  });

  it("is deterministic: identical inputs produce identical outputs", () => {
    const a = run("sim");
    const b = run("sim");
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("never emits probabilities or percentages anywhere", () => {
    const d = run("sim");
    const json = JSON.stringify(d);
    expect(json).not.toMatch(/%/);
    expect(json).not.toMatch(/probability/);
    expect(d.risk.level).not.toBeNull();
  });

  it("exposes the scenario id for the demo", () => {
    expect(SIM_SWAP_SCENARIO_ID).toBe("sim_swap");
  });
});
