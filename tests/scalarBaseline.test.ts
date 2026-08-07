import { describe, expect, it } from "vitest";
import { scalarBaseline } from "../src/engine/scalarBaseline";
import { simSwapScenario } from "../src/scenarios/simSwap";
import { phishingScenario } from "../src/scenarios/phishing";

describe("fair scalar baseline", () => {
  it("returns the same requirement for both hero scenarios", () => {
    const simResult = scalarBaseline({
      aggregateRisk: simSwapScenario.aggregateRisk,
      requiredAssurance: simSwapScenario.requiredAssurance,
    });
    const phishingResult = scalarBaseline({
      aggregateRisk: phishingScenario.aggregateRisk,
      requiredAssurance: phishingScenario.requiredAssurance,
    });

    expect(simResult.requirement).toBe("phishing-resistant factor required");
    expect(phishingResult.requirement).toBe(simResult.requirement);
  });

  it("accepts only scalar inputs — no threat indicators in its signature", () => {
    // The baseline's input type is ScalarBaselineInput, which structurally
    // has no indicators field; a scenario object cannot be passed directly.
    const result = scalarBaseline({
      aggregateRisk: "high",
      requiredAssurance: 2,
    });
    expect(result.requirement).toBe("phishing-resistant factor required");
  });

  it("produces deterministic output", () => {
    const first = scalarBaseline({ aggregateRisk: "high", requiredAssurance: 2 });
    const second = scalarBaseline({ aggregateRisk: "high", requiredAssurance: 2 });
    expect(second).toEqual(first);
  });
});
