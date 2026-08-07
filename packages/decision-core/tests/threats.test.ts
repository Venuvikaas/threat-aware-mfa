/**
 * Multi-hypothesis threat assessment coverage (EXECUTION_new2.md Phase 1).
 *
 * - Hypotheses coexist without normalization (a SIM-change decision also
 *   reports an UNSUPPORTED phishing hypothesis).
 * - Stale primary evidence can never produce STRONG or MODERATE support.
 * - A fresh conflicting evidence suppresses a hypothesis to UNSUPPORTED
 *   unless a fresh primary also exists.
 */
import { describe, expect, it } from "vitest";
import { assessThreats, normalizeEvidence } from "@mfa/decision-core";
import { DEMO_POLICY_BUNDLE } from "@mfa/policy-bundles";
import type { EvidenceItem } from "@mfa/contracts";

const NOW = "2026-08-07T08:00:00.000Z";

function ev(
  type: EvidenceItem["type"],
  value: EvidenceItem["value"],
  _index: number,
  opts: { stale?: boolean } = {}
): EvidenceItem {
  return normalizeEvidence(
    [
      {
        type,
        value,
        providerId: "test",
        providerType: "test",
        observedAt: opts.stale ? "2026-08-01T00:00:00.000Z" : NOW,
        validUntil: opts.stale ? "2026-08-01T01:00:00.000Z" : null,
        synthetic: true,
        quality: "CONFIRMED",
      },
    ],
    NOW
  )[0];
}

describe("assessThreats", () => {
  it("reports STRONG SIM-channel compromise from fresh primary + supporting", () => {
    const evidence = [
      ev("RECENT_SIM_CHANGE", true, 0),
      ev("FIRST_SEEN_DEVICE", true, 1),
      ev("FAILED_LOGIN_BURST", true, 2),
    ];
    const threats = assessThreats(evidence, DEMO_POLICY_BUNDLE);
    const sim = threats.find((t) => t.threatId === "SIM_CHANNEL_COMPROMISE");
    expect(sim?.support).toBe("STRONG");
    expect(sim?.supportingEvidenceIds).toContain("ev_0");
    expect(sim?.activatedRuleIds).toContain("threat_sim_primary");
  });

  it("hypotheses coexist without normalization", () => {
    const evidence = [ev("RECENT_SIM_CHANGE", true, 0), ev("HIGH_VALUE_TRANSACTION", true, 1)];
    const threats = assessThreats(evidence, DEMO_POLICY_BUNDLE);
    const sim = threats.find((t) => t.threatId === "SIM_CHANNEL_COMPROMISE");
    const phish = threats.find((t) => t.threatId === "PHISHING_RELAY");
    const dev = threats.find((t) => t.threatId === "DEVICE_INTEGRITY_CONCERN");
    // All three hypotheses are reported independently — never one label.
    expect(threats).toHaveLength(3);
    expect(sim?.support).toBe("STRONG");
    expect(phish?.support).toBe("UNSUPPORTED");
    expect(dev?.support).toBe("UNSUPPORTED");
  });

  it("stale primary evidence cannot produce STRONG or MODERATE support", () => {
    const evidence = [ev("RECENT_SIM_CHANGE", true, 0, { stale: true })];
    const threats = assessThreats(evidence, DEMO_POLICY_BUNDLE);
    const sim = threats.find((t) => t.threatId === "SIM_CHANNEL_COMPROMISE");
    expect(sim?.support).toBe("WEAK");
  });

  it("fresh conflicting evidence suppresses a hypothesis without fresh primary", () => {
    // A SIM-change observation matches PHISHING_RELAY's CONFLICTING rule but
    // not its primary — so the phishing hypothesis is suppressed.
    const evidence = [ev("RECENT_SIM_CHANGE", true, 0)];
    const threats = assessThreats(evidence, DEMO_POLICY_BUNDLE);
    const phish = threats.find((t) => t.threatId === "PHISHING_RELAY");
    expect(phish?.support).toBe("UNSUPPORTED");
    expect(phish?.conflictingEvidenceIds).toContain("ev_0");
    // While the SIM hypothesis itself is supported.
    expect(threats.find((t) => t.threatId === "SIM_CHANNEL_COMPROMISE")?.support).toBe("MODERATE");
  });

  it("fresh primary outweighs conflicting evidence", () => {
    const evidence = [
      ev("PHISHING_RELAY_INDICATOR", true, 0),
      ev("RECENT_SIM_CHANGE", true, 1),
      ev("FAILED_LOGIN_BURST", true, 2),
    ];
    const threats = assessThreats(evidence, DEMO_POLICY_BUNDLE);
    const phish = threats.find((t) => t.threatId === "PHISHING_RELAY");
    // Primary fresh + supporting fresh -> STRONG even though a conflicting
    // SIM-change observation exists.
    expect(phish?.support).toBe("STRONG");
  });

  it("MODERATE from fresh primary alone", () => {
    const evidence = [ev("RECENT_SIM_CHANGE", true, 0)];
    const threats = assessThreats(evidence, DEMO_POLICY_BUNDLE);
    expect(threats.find((t) => t.threatId === "SIM_CHANNEL_COMPROMISE")?.support).toBe(
      "MODERATE"
    );
  });
});
