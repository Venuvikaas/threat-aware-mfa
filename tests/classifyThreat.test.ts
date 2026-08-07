import { describe, expect, it } from "vitest";
import { classifyThreat } from "../src/engine/classifyThreat";
import type { Scenario } from "../src/engine/types";
import { demoPolicy } from "../src/policy/demoPolicy";

function makeScenario(
  overrides: Partial<Scenario["indicators"]> = {}
): Scenario {
  return {
    id: "test-scenario",
    title: "Test scenario",
    aggregateRisk: "high",
    requiredAssurance: 2,
    transaction: { amount: 12500, currency: "INR", payeeType: "new" },
    indicators: {
      recentSimChange: false,
      phishingRelayIndicator: false,
      newDevice: false,
      unusualSession: false,
      newPayee: false,
      ...overrides,
    },
    capabilities: { passkeyEnrolled: true },
  };
}

describe("classifyThreat", () => {
  it("classifies a supported SIM-change hypothesis with high support", () => {
    const classification = classifyThreat(
      makeScenario({
        recentSimChange: true,
        newDevice: true,
        newPayee: true,
      }),
      demoPolicy
    );

    expect(classification.hypothesis).toBe("sim_channel_compromise");
    expect(classification.supportBand).toBe("high_support");
    expect(classification.doNotTrust).toContain("Phone number (SMS channel)");
    expect(classification.evidenceUsed).toContain("Recent SIM change");
  });

  it("classifies a supported phishing-relay hypothesis with high support", () => {
    const classification = classifyThreat(
      makeScenario({
        phishingRelayIndicator: true,
        unusualSession: true,
        newPayee: true,
      }),
      demoPolicy
    );

    expect(classification.hypothesis).toBe("phishing");
    expect(classification.supportBand).toBe("high_support");
    expect(classification.doNotTrust).toContain(
      "SMS relay path (one-time code delivery)"
    );
    expect(classification.evidenceUsed).toContain("Phishing relay indicator");
  });

  it("returns moderate support for a lone primary indicator", () => {
    const classification = classifyThreat(
      makeScenario({ recentSimChange: true }),
      demoPolicy
    );

    expect(classification.hypothesis).toBe("sim_channel_compromise");
    expect(classification.supportBand).toBe("moderate_support");
  });

  it("returns insufficient evidence when no primary indicator is present", () => {
    const classification = classifyThreat(
      makeScenario({ newDevice: true }),
      demoPolicy
    );

    expect(classification.hypothesis).toBe("insufficient_evidence");
    expect(classification.supportBand).toBe("insufficient_evidence");
    expect(classification.doNotTrust).toEqual([]);
  });

  it("returns insufficient evidence when both primary indicators conflict", () => {
    const classification = classifyThreat(
      makeScenario({
        recentSimChange: true,
        phishingRelayIndicator: true,
      }),
      demoPolicy
    );

    expect(classification.hypothesis).toBe("insufficient_evidence");
    expect(classification.supportBand).toBe("insufficient_evidence");
    // The policy must not invent a confident threat from conflicting input.
    expect(classification.doNotTrust).toEqual([]);
  });

  it("never outputs a decimal probability", () => {
    const classification = classifyThreat(
      makeScenario({ recentSimChange: true, newDevice: true }),
      demoPolicy
    );

    expect(JSON.stringify(classification)).not.toMatch(/\d+\.\d+/);
  });
});
