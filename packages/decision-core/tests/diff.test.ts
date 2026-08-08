/**
 * Semantic decision diff tests (EXECUTION_new2.md Phase 6).
 *
 * - Exact replay of identical inputs yields an empty diff (identical=true).
 * - One-signal forks (evidence or capability) produce the documented sections:
 *   INPUT for evidence changes, FACTOR/SELECTION for derived-state changes.
 * - Generated ids and timestamps never appear as changes.
 */
import { describe, expect, it } from "vitest";
import {
  applyCapabilityOverrides,
  applyEvidenceOverrides,
  buildDecisionDiff,
  diffDecisions,
  evaluateDecision,
  normalizeEvidence,
  type RawEvidence,
} from "@mfa/decision-core";
import { DEMO_POLICY_BUNDLE } from "@mfa/policy-bundles";
import { constrainedCapabilityScenario, phishingScenario, simSwapScenario } from "@mfa/demo-data";
import type { CapabilityState, DecisionResponse } from "@mfa/contracts";

const NOW = "2026-08-07T08:00:00.000Z";

const AARAV_CAPS: CapabilityState[] = [
  { capabilityId: "PASSKEY_ENROLLED", available: true },
  { capabilityId: "WEBAUTHN_SUPPORTED", available: true },
  { capabilityId: "NETWORK_AVAILABLE", available: true },
  { capabilityId: "TOTP_SEED", available: false },
];

function evidenceFromOverrides(overrides: { type: string; value: RawEvidence["value"] }[]) {
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

function decisionFrom(
  overrides: { type: string; value: RawEvidence["value"] }[],
  capabilities: CapabilityState[],
  decisionId = "dec_test"
): DecisionResponse {
  const evidence = evidenceFromOverrides(overrides);
  const output = evaluateDecision({ evidence, capabilities, policy: DEMO_POLICY_BUNDLE });
  return {
    decisionId,
    transactionId: "txn_test",
    policy: {
      bundleId: DEMO_POLICY_BUNDLE.id,
      version: DEMO_POLICY_BUNDLE.version,
      contentHash: DEMO_POLICY_BUNDLE.contentHash,
    },
    risk: output.risk,
    evidence,
    threats: output.threats,
    trust: output.trust,
    factors: output.factors,
    selectedFactorId: output.selectedFactorId,
    action: output.action,
    trace: output.trace,
    createdAt: NOW,
  };
}

const SIM_OVERRIDES = simSwapScenario.build("ct_diff").evidenceOverrides ?? [];
const PHISH_OVERRIDES = phishingScenario.build("ct_diff").evidenceOverrides ?? [];
const CONSTRAINED_OVERRIDES = constrainedCapabilityScenario.build("ct_diff").evidenceOverrides ?? [];

describe("diffDecisions", () => {
  it("returns an empty diff for semantically identical decisions (exact replay)", () => {
    const a = decisionFrom(SIM_OVERRIDES, AARAV_CAPS, "dec_a");
    const b = decisionFrom(SIM_OVERRIDES, AARAV_CAPS, "dec_b");
    // Different generated ids and creation timestamps must not surface.
    expect(a.decisionId).not.toBe(b.decisionId);
    expect(diffDecisions(a, b)).toEqual([]);
    expect(buildDecisionDiff("rp_1", "dec_a", a, b).identical).toBe(true);
  });

  it("detects an INPUT change when evidence value flips", () => {
    const before = decisionFrom(SIM_OVERRIDES, AARAV_CAPS);
    const changed = decisionFrom(
      SIM_OVERRIDES.map((o) => (o.type === "RECENT_SIM_CHANGE" ? { ...o, value: false } : o)),
      AARAV_CAPS
    );
    const sections = diffDecisions(before, changed);
    const input = sections.find((s) => s.section === "INPUT");
    expect(input).toBeDefined();
    expect(input!.changes.length).toBeGreaterThan(0);
  });

  it("reports FACTOR + SELECTION deltas for a capability fork (passkey unavailable)", () => {
    const before = decisionFrom(SIM_OVERRIDES, AARAV_CAPS);
    // Replay with passkey enrollment removed — the constrained-capability shape.
    const evidence = evidenceFromOverrides(SIM_OVERRIDES);
    const capabilities = applyCapabilityOverrides(AARAV_CAPS, [
      { capabilityId: "PASSKEY_ENROLLED", available: false },
    ]);
    const output = evaluateDecision({ evidence, capabilities, policy: DEMO_POLICY_BUNDLE });
    const after: DecisionResponse = {
      ...before,
      decisionId: "dec_fork",
      factors: output.factors,
      selectedFactorId: output.selectedFactorId,
      action: output.action,
      threats: output.threats,
      trust: output.trust,
      trace: output.trace,
      risk: output.risk,
    };

    const sections = diffDecisions(before, after);
    const factor = sections.find((s) => s.section === "FACTOR");
    const selection = sections.find((s) => s.section === "SELECTION");
    expect(factor).toBeDefined();
    expect(factor!.changes.some((c) => c.path.startsWith("factors.PASSKEY"))).toBe(true);
    expect(selection).toBeDefined();
    // Threat and trust stay identical — only capability-derived state changes.
    expect(sections.some((s) => s.section === "THREAT")).toBe(false);
    expect(sections.some((s) => s.section === "TRUST")).toBe(false);
  });

  it("shows a THREAT/TRUST delta when the SIM signal is removed", () => {
    const before = decisionFrom(SIM_OVERRIDES, AARAV_CAPS);
    const evidence = applyEvidenceOverrides(
      evidenceFromOverrides(SIM_OVERRIDES),
      [{ type: "RECENT_SIM_CHANGE", value: false }],
      NOW
    );
    const output = evaluateDecision({ evidence, capabilities: AARAV_CAPS, policy: DEMO_POLICY_BUNDLE });
    const after: DecisionResponse = { ...before, decisionId: "dec_fork", ...output, evidence };

    const sections = diffDecisions(before, after);
    expect(sections.some((s) => s.section === "THREAT")).toBe(true);
    expect(sections.some((s) => s.section === "TRUST")).toBe(true);
  });

  it("compares different scenarios as non-identical with threat/trust deltas", () => {
    const sim = decisionFrom(SIM_OVERRIDES, AARAV_CAPS);
    const phish = decisionFrom(PHISH_OVERRIDES, AARAV_CAPS);
    const sections = diffDecisions(sim, phish);
    expect(sections.length).toBeGreaterThan(0);
    expect(sections.some((s) => s.section === "THREAT")).toBe(true);
    expect(sections.some((s) => s.section === "TRUST")).toBe(true);
  });

  it("shows RULE deltas when activated rules differ between scenarios", () => {
    const sim = decisionFrom(SIM_OVERRIDES, AARAV_CAPS);
    const phish = decisionFrom(PHISH_OVERRIDES, AARAV_CAPS);
    const sections = diffDecisions(sim, phish);
    expect(sections.some((s) => s.section === "RULE")).toBe(true);
  });

  it("treats the constrained-capability decision as a genuine fork of the SIM decision", () => {
    const sim = decisionFrom(SIM_OVERRIDES, AARAV_CAPS);
    const constrained = decisionFrom(CONSTRAINED_OVERRIDES, [
      ...AARAV_CAPS.map((c) => (c.capabilityId === "PASSKEY_ENROLLED" ? { ...c, available: false } : c)),
    ]);
    const sections = diffDecisions(sim, constrained);
    expect(sections.find((s) => s.section === "SELECTION")?.changes.length).toBeGreaterThan(0);
  });
});
