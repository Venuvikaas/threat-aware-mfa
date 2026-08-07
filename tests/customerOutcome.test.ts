import { describe, expect, it } from "vitest";
import { evaluateScenario } from "../src/engine/evaluateScenario";
import { simSwapScenario } from "../src/scenarios/simSwap";
import { phishingScenario } from "../src/scenarios/phishing";
import { demoPolicy } from "../src/policy/demoPolicy";

const APPROVED_MESSAGES = [
  "Use your passkey to authorize this payment.",
  "Payment paused. Continue through assisted recovery.",
] as const;

describe("simulated customer outcome preview", () => {
  it("shows only approved copy when a factor is selected", () => {
    for (const scenario of [simSwapScenario, phishingScenario]) {
      const decision = evaluateScenario(scenario, demoPolicy);
      expect(decision.outcome).toBe("factor_selected");
      expect(APPROVED_MESSAGES).toContain(decision.outcomeMessage);
    }
  });

  it("shows only approved copy for assisted recovery", () => {
    const decision = evaluateScenario(
      { ...simSwapScenario, capabilities: { passkeyEnrolled: false } },
      demoPolicy
    );
    expect(decision.outcome).toBe("assisted_recovery");
    expect(APPROVED_MESSAGES).toContain(decision.outcomeMessage);
    expect(decision.outcomeMessage).toBe(
      "Payment paused. Continue through assisted recovery."
    );
  });

  it("never claims authentication is executed in the preview copy", () => {
    for (const scenario of [simSwapScenario, phishingScenario]) {
      const decision = evaluateScenario(scenario, demoPolicy);
      expect(decision.outcomeMessage).not.toMatch(/authorized|completed|executed/i);
    }
  });
});
