import { describe, expect, it } from "vitest";
import { evaluateScenario } from "../src/engine/evaluateScenario";
import { decisionToJson } from "../src/engine/decisionToJson";
import type { Decision } from "../src/engine/types";
import { simSwapScenario } from "../src/scenarios/simSwap";
import { phishingScenario } from "../src/scenarios/phishing";
import { demoPolicy } from "../src/policy/demoPolicy";

const DECISION_KEYS = [
  "scenarioId",
  "policyVersion",
  "hypothesis",
  "supportBand",
  "evidenceUsed",
  "doNotTrust",
  "factors",
  "selectedFactor",
  "outcome",
  "outcomeMessage",
] as const;

const FACTOR_KEYS = [
  "factorId",
  "state",
  "reasonCode",
  "reason",
  "assurance",
] as const;

describe("decision JSON export", () => {
  it("exports exactly the engine output for both hero scenarios", () => {
    for (const scenario of [simSwapScenario, phishingScenario]) {
      const decision = evaluateScenario(scenario, demoPolicy);
      const parsed = JSON.parse(decisionToJson(decision)) as Decision;
      expect(parsed).toEqual(decision);
    }
  });

  it("contains only Decision-contract top-level fields (no UI-only fields)", () => {
    const decision = evaluateScenario(simSwapScenario, demoPolicy);
    const parsed = JSON.parse(decisionToJson(decision)) as Decision;

    expect(Object.keys(parsed).sort()).toEqual([...DECISION_KEYS].sort());
    for (const factor of parsed.factors) {
      expect(Object.keys(factor).sort()).toEqual([...FACTOR_KEYS].sort());
    }
  });

  it("round-trips factor state and reason codes without loss", () => {
    const decision = evaluateScenario(
      { ...simSwapScenario, capabilities: { passkeyEnrolled: false } },
      demoPolicy
    );
    const parsed = JSON.parse(decisionToJson(decision)) as Decision;

    expect(parsed.outcome).toBe("assisted_recovery");
    const passkey = parsed.factors.find((f) => f.factorId === "passkey")!;
    expect(passkey.state).toBe("unavailable");
    expect(passkey.reasonCode).toBe("PASSKEY_NOT_ENROLLED");
  });
});
