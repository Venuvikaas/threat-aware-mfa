import type { Decision, Policy, Scenario } from "./types";
import { classifyThreat } from "./classifyThreat";
import { evaluateFactors } from "./evaluateFactors";
import { selectOutcome } from "./selectOutcome";

/**
 * The pure decision kernel: Scenario + Policy -> Decision.
 *
 * The function has no React, storage, network, clock, random, or browser
 * dependency. Identical inputs always return a deeply equal decision.
 */
export function evaluateScenario(scenario: Scenario, policy: Policy): Decision {
  const classification = classifyThreat(scenario, policy);
  const factors = evaluateFactors(scenario, policy, classification.hypothesis);
  const selection = selectOutcome(factors, policy);

  return {
    scenarioId: scenario.id,
    policyVersion: policy.version,
    hypothesis: classification.hypothesis,
    supportBand: classification.supportBand,
    evidenceUsed: classification.evidenceUsed,
    doNotTrust: classification.doNotTrust,
    factors,
    selectedFactor: selection.selectedFactor,
    outcome: selection.outcome,
    outcomeMessage: selection.outcomeMessage,
  };
}
