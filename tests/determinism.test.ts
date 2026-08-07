import { describe, expect, it } from "vitest";
import { evaluateScenario } from "../src/engine/evaluateScenario";
import type { Scenario } from "../src/engine/types";
import { demoPolicy } from "../src/policy/demoPolicy";

const scenario: Scenario = {
  id: "determinism-scenario",
  title: "Determinism scenario",
  aggregateRisk: "high",
  requiredAssurance: 2,
  transaction: { amount: 12500, currency: "INR", payeeType: "new" },
  indicators: {
    recentSimChange: true,
    phishingRelayIndicator: false,
    newDevice: true,
    unusualSession: false,
    newPayee: true,
  },
  capabilities: { passkeyEnrolled: true },
};

describe("determinism", () => {
  it("returns deeply equal decisions for identical input", () => {
    const first = evaluateScenario(scenario, demoPolicy);
    const second = evaluateScenario(scenario, demoPolicy);

    expect(second).toEqual(first);
  });

  it("returns identical serialized output for identical input", () => {
    const first = JSON.stringify(evaluateScenario(scenario, demoPolicy));
    const second = JSON.stringify(evaluateScenario(scenario, demoPolicy));

    expect(second).toBe(first);
  });
});
