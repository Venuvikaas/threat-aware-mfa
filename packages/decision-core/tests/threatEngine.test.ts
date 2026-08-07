/**
 * Threat engine tests (docs/EXECUTION.md Phase 2):
 * SIM change, phishing relay, insufficient evidence, and conflicting evidence.
 */
import { describe, expect, it } from "vitest";
import { evaluateThreat, type ThreatInput } from "../src/threatEngine.js";
import { DEMO_POLICY } from "../src/policy.js";

function base(): ThreatInput {
  return {
    recentSimChange: false,
    phishingRelayIndicator: false,
    firstSeen: false,
    payeeIsKnown: true,
    amountMinor: 5000,
    failedLoginCount: 0,
    sessionAgeSeconds: 3600,
  };
}

describe("evaluateThreat", () => {
  it("returns SIM_CHANNEL_COMPROMISE with HIGH support and full context", () => {
    const result = evaluateThreat({
      ...base(),
      recentSimChange: true,
      firstSeen: true,
      payeeIsKnown: false,
      amountMinor: DEMO_POLICY.highValueAmountMinor,
    });
    expect(result.type).toBe("SIM_CHANNEL_COMPROMISE");
    expect(result.support).toBe("HIGH");
    expect(result.evidence).toEqual([
      "recent_sim_change",
      "first_seen_device",
      "new_payee",
      "high_value_transfer",
    ]);
  });

  it("returns SIM_CHANNEL_COMPROMISE with MODERATE support without context", () => {
    const result = evaluateThreat({ ...base(), recentSimChange: true });
    expect(result.type).toBe("SIM_CHANNEL_COMPROMISE");
    expect(result.support).toBe("MODERATE");
    expect(result.evidence).toEqual(["recent_sim_change"]);
  });

  it("returns PHISHING with phishing-specific evidence", () => {
    const result = evaluateThreat({ ...base(), phishingRelayIndicator: true });
    expect(result.type).toBe("PHISHING");
    expect(result.support).toBe("MODERATE");
    expect(result.evidence).toEqual(["phishing_relay_indicator"]);
  });

  it("raises PHISHING support to HIGH with enough supporting context", () => {
    const result = evaluateThreat({
      ...base(),
      phishingRelayIndicator: true,
      firstSeen: true,
      payeeIsKnown: false,
    });
    expect(result.type).toBe("PHISHING");
    expect(result.support).toBe("HIGH");
    expect(result.evidence).toEqual([
      "phishing_relay_indicator",
      "first_seen_device",
      "new_payee",
    ]);
  });

  it("keeps PHISHING support MODERATE with a single supporting context", () => {
    const result = evaluateThreat({
      ...base(),
      phishingRelayIndicator: true,
      sessionAgeSeconds: 60,
    });
    expect(result.type).toBe("PHISHING");
    expect(result.support).toBe("MODERATE");
    expect(result.evidence).toEqual(["phishing_relay_indicator", "unusual_session"]);
  });

  it("returns INSUFFICIENT_EVIDENCE for conflicting primary indicators", () => {
    const result = evaluateThreat({
      ...base(),
      recentSimChange: true,
      phishingRelayIndicator: true,
    });
    expect(result.type).toBe("INSUFFICIENT_EVIDENCE");
    expect(result.support).toBe("INSUFFICIENT");
    expect(result.evidence).toEqual(["conflicting_primary_indicators"]);
  });

  it("returns INSUFFICIENT_EVIDENCE when no primary indicator exists", () => {
    const result = evaluateThreat(base());
    expect(result.type).toBe("INSUFFICIENT_EVIDENCE");
    expect(result.support).toBe("INSUFFICIENT");
    expect(result.evidence).toEqual(["no_supported_primary_indicator"]);
  });

  it("returns INSUFFICIENT_EVIDENCE when the SIM signal is unavailable", () => {
    const result = evaluateThreat({ ...base(), recentSimChange: null });
    expect(result.type).toBe("INSUFFICIENT_EVIDENCE");
    expect(result.evidence).toEqual(["primary_signal_unavailable"]);
  });
});
