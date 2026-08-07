import { describe, expect, it } from "vitest";
import { evaluateScenario } from "../src/engine/evaluateScenario";
import type { Scenario } from "../src/engine/types";
import { demoPolicy } from "../src/policy/demoPolicy";

function makeScenario(
  overrides: Partial<Scenario["indicators"]> = {}
): Scenario {
  return {
    id: "unknown-scenario",
    title: "Unknown evidence",
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

describe("conservative unknown handling", () => {
  it("does not produce a confident hypothesis from unsupported evidence", () => {
    // A new device alone is not a supported primary indicator.
    const decision = evaluateScenario(
      makeScenario({ newDevice: true }),
      demoPolicy
    );

    expect(decision.hypothesis).toBe("insufficient_evidence");
    expect(decision.supportBand).toBe("insufficient_evidence");
    expect(decision.doNotTrust).toEqual([]);
  });

  it("does not produce a confident hypothesis from conflicting primary indicators", () => {
    const decision = evaluateScenario(
      makeScenario({
        recentSimChange: true,
        phishingRelayIndicator: true,
      }),
      demoPolicy
    );

    expect(decision.hypothesis).toBe("insufficient_evidence");
    expect(decision.supportBand).toBe("insufficient_evidence");
    // No channel is placed under suspicion when the policy cannot resolve.
    expect(decision.doNotTrust).toEqual([]);
  });

  it("keeps every factor fully specified even under insufficient evidence", () => {
    const decision = evaluateScenario(
      makeScenario({ newDevice: true }),
      demoPolicy
    );

    for (const factor of decision.factors) {
      expect(["eligible", "excluded", "unavailable"]).toContain(factor.state);
      expect(factor.reasonCode).toBeTruthy();
      expect(factor.reason).toBeTruthy();
    }
  });
});
