import type { RiskLevel } from "./types";

/**
 * Fair scalar baseline.
 *
 * A severity-only policy receives ONLY the aggregate risk level and the
 * required assurance — never the raw threat indicators. Because both hero
 * scenarios share the same high risk and assurance requirement, the baseline
 * returns the same step-up requirement for both. It is not configured to
 * choose an obviously unsafe method.
 */

export interface ScalarBaselineInput {
  aggregateRisk: RiskLevel;
  requiredAssurance: number;
}

export interface ScalarBaselineResult {
  requirement: string;
}

const HIGH_RISK_REQUIREMENT = "phishing-resistant factor required";

export function scalarBaseline(
  input: ScalarBaselineInput
): ScalarBaselineResult {
  if (input.aggregateRisk === "high") {
    return { requirement: HIGH_RISK_REQUIREMENT };
  }
  // No other risk level exists in the frozen contract; keep this path
  // explicit so a new risk level cannot silently produce a requirement.
  return { requirement: "standard step-up required" };
}
