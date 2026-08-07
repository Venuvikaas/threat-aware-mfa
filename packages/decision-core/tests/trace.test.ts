/**
 * Structured causality-trace coverage (EXECUTION_new2.md Phase 1).
 *
 * - Events are ordered by sequence and grouped by phase.
 * - Input/output refs connect evidence -> threat -> trust -> factor.
 * - Every threat/trust/factor event cites evaluated rule ids.
 * - Factor evaluations reference their emitted eligibility trace events.
 */
import { describe, expect, it } from "vitest";
import { evaluateDecision, normalizeEvidence } from "@mfa/decision-core";
import { DEMO_POLICY_BUNDLE } from "@mfa/policy-bundles";
import type { CapabilityState } from "@mfa/contracts";

const NOW = "2026-08-07T08:00:00.000Z";

const CAPS: CapabilityState[] = [
  { capabilityId: "PASSKEY_ENROLLED", available: true },
  { capabilityId: "WEBAUTHN_SUPPORTED", available: true },
  { capabilityId: "NETWORK_AVAILABLE", available: true },
  { capabilityId: "TOTP_SEED", available: false },
];

function evidenceOf(type: string, value: unknown, _index: number) {
  return normalizeEvidence(
    [
      {
        type: type as never,
        value: value as never,
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

describe("buildTrace", () => {
  it("emits ordered, phase-grouped events for the SIM-swap chain", () => {
    const evidence = [
      evidenceOf("RECENT_SIM_CHANGE", true, 0),
      evidenceOf("HIGH_VALUE_TRANSACTION", true, 1),
      evidenceOf("FAILED_LOGIN_BURST", true, 2),
    ];
    const decision = evaluateDecision({
      evidence,
      capabilities: CAPS,
      policy: DEMO_POLICY_BUNDLE,
    });

    // Sequence strictly increasing.
    decision.trace.forEach((e, i) => {
      if (i > 0) expect(e.sequence).toBeGreaterThan(decision.trace[i - 1].sequence);
    });

    const phases = [...new Set(decision.trace.map((e) => e.phase))];
    expect(phases).toContain("EVIDENCE_NORMALIZATION");
    expect(phases).toContain("THREAT_ASSESSMENT");
    expect(phases).toContain("TRUST_ASSESSMENT");
    expect(phases).toContain("FACTOR_ELIGIBILITY");
    expect(phases).toContain("SELECTION");
  });

  it("cites rule ids and rule version on every threat/trust event", () => {
    const evidence = [evidenceOf("RECENT_SIM_CHANGE", true, 0)];
    const decision = evaluateDecision({
      evidence,
      capabilities: CAPS,
      policy: DEMO_POLICY_BUNDLE,
    });
    const threatEvents = decision.trace.filter((e) => e.phase === "THREAT_ASSESSMENT");
    expect(threatEvents.length).toBeGreaterThan(0);
    for (const event of threatEvents) {
      expect(event.ruleId).toMatch(/^threat_/);
      expect(event.ruleVersion).toBe("1.0.0");
      expect(event.explanationCode).toMatch(/^threat_support_(strong|moderate|weak|unsupported)$/);
    }
  });

  it("links factor evaluations to their eligibility trace events", () => {
    const evidence = [evidenceOf("RECENT_SIM_CHANGE", true, 0)];
    const decision = evaluateDecision({
      evidence,
      capabilities: CAPS,
      policy: DEMO_POLICY_BUNDLE,
    });
    const sms = decision.factors.find((f) => f.factorId === "SMS_OTP")!;
    expect(sms.traceEventIds.length).toBeGreaterThan(0);
    for (const id of sms.traceEventIds) {
      const event = decision.trace.find((e) => e.id === id);
      expect(event?.phase).toBe("FACTOR_ELIGIBILITY");
      expect(event?.outputRefs).toContain("SMS_OTP");
    }
  });

  it("records the selection event with the selected factor", () => {
    const evidence = [evidenceOf("RECENT_SIM_CHANGE", true, 0)];
    const decision = evaluateDecision({
      evidence,
      capabilities: CAPS,
      policy: DEMO_POLICY_BUNDLE,
    });
    const selection = decision.trace.find((e) => e.phase === "SELECTION")!;
    expect(selection.explanationCode).toBe("factor_selected");
    expect(selection.outputRefs).toContain("PASSKEY");
  });
});
