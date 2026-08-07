/**
 * Risk engine tests (docs/EXECUTION.md Phase 2):
 * low, medium, high, threshold boundary, and missing-signal cases.
 */
import { describe, expect, it } from "vitest";
import { evaluateRisk, type RiskInput } from "../src/riskEngine.js";
import { DEMO_POLICY } from "../src/policy.js";

function base(): RiskInput {
  return {
    amountMinor: 5000,
    payeeIsKnown: true,
    firstSeen: false,
    failedLoginCount: 0,
    sessionAgeSeconds: 3600,
    recentSimChange: false,
    geoDistanceFromLastLoginKm: 10,
    phishingRelayIndicator: false,
  };
}

describe("evaluateRisk", () => {
  it("returns LOW with no observed indicators", () => {
    const result = evaluateRisk(base());
    expect(result.level).toBe("LOW");
    expect(result.reasons).toEqual([]);
  });

  it("returns MEDIUM for a new payee alone", () => {
    const result = evaluateRisk({ ...base(), payeeIsKnown: false });
    expect(result.level).toBe("MEDIUM");
    expect(result.reasons).toEqual(["new_payee"]);
  });

  it("returns MEDIUM for an unusual short session alone", () => {
    const result = evaluateRisk({ ...base(), sessionAgeSeconds: 120 });
    expect(result.level).toBe("MEDIUM");
    expect(result.reasons).toContain("unusual_session");
  });

  it("returns HIGH for a recent SIM change", () => {
    const result = evaluateRisk({ ...base(), recentSimChange: true });
    expect(result.level).toBe("HIGH");
    expect(result.reasons).toContain("recent_sim_change");
  });

  it("returns HIGH for a first-seen device", () => {
    const result = evaluateRisk({ ...base(), firstSeen: true });
    expect(result.level).toBe("HIGH");
    expect(result.reasons).toContain("first_seen_device");
  });

  it("returns HIGH for a phishing-relay indicator", () => {
    const result = evaluateRisk({ ...base(), phishingRelayIndicator: true });
    expect(result.level).toBe("HIGH");
    expect(result.reasons).toContain("phishing_relay_indicator");
  });

  it("returns HIGH at and above the high-value threshold boundary", () => {
    const threshold = DEMO_POLICY.highValueAmountMinor;
    expect(evaluateRisk({ ...base(), amountMinor: threshold - 1 }).level).toBe(
      "LOW"
    );
    expect(evaluateRisk({ ...base(), amountMinor: threshold }).level).toBe("HIGH");
    expect(evaluateRisk({ ...base(), amountMinor: threshold + 1 }).level).toBe(
      "HIGH"
    );
  });

  it("returns HIGH for a large geo distance at the threshold", () => {
    const threshold = DEMO_POLICY.largeGeoDistanceKm;
    expect(
      evaluateRisk({ ...base(), geoDistanceFromLastLoginKm: threshold - 1 }).level
    ).toBe("LOW");
    expect(
      evaluateRisk({ ...base(), geoDistanceFromLastLoginKm: threshold }).level
    ).toBe("HIGH");
  });

  it("returns HIGH for repeated failed logins at the threshold", () => {
    const threshold = DEMO_POLICY.failedLoginThreshold;
    expect(evaluateRisk({ ...base(), failedLoginCount: threshold - 1 }).level).toBe(
      "LOW"
    );
    expect(evaluateRisk({ ...base(), failedLoginCount: threshold }).level).toBe(
      "HIGH"
    );
  });

  it("returns HIGH for a new payee combined with another indicator", () => {
    const result = evaluateRisk({ ...base(), payeeIsKnown: false, sessionAgeSeconds: 60 });
    expect(result.level).toBe("HIGH");
    expect(result.reasons).toEqual(["new_payee", "unusual_session"]);
  });

  it("treats a null SIM signal as unknown, not as a safe signal", () => {
    const result = evaluateRisk({ ...base(), recentSimChange: null });
    expect(result.level).toBe("LOW");
    expect(result.reasons).not.toContain("recent_sim_change");
  });

  it("treats a null geo distance as unknown", () => {
    const result = evaluateRisk({ ...base(), geoDistanceFromLastLoginKm: null });
    expect(result.level).toBe("LOW");
    expect(result.reasons).not.toContain("large_geo_distance");
  });
});
