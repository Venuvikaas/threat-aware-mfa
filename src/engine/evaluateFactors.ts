import type {
  FactorEvaluation,
  FactorPolicy,
  Policy,
  Scenario,
  ThreatHypothesis,
} from "./types";

/**
 * Evaluate every factor against threat compatibility, user capability, and
 * the assurance gate. Every factor receives exactly one state.
 *
 * State precedence (first matching rule wins):
 * 1. `excluded` when threat-incompatible
 * 2. `unavailable` when not user-completable
 * 3. `excluded` when assurance is below the scenario threshold
 * 4. `eligible` otherwise
 */
export function evaluateFactors(
  scenario: Scenario,
  policy: Policy,
  hypothesis: ThreatHypothesis
): FactorEvaluation[] {
  return policy.factors.map((factor) =>
    evaluateFactor(scenario, factor, hypothesis)
  );
}

function evaluateFactor(
  scenario: Scenario,
  factor: FactorPolicy,
  hypothesis: ThreatHypothesis
): FactorEvaluation {
  const threatReason = factor.excludedReasonByHypothesis[hypothesis];

  // 1. Threat incompatibility wins.
  if (factor.incompatibleWith.includes(hypothesis) && threatReason) {
    return {
      factorId: factor.factorId,
      state: "excluded",
      reasonCode: threatReason.reasonCode,
      reason: threatReason.reason,
      assurance: factor.assurance,
    };
  }

  // 2. Capability gate: can the user complete this factor?
  if (
    factor.availabilityRequirement === "passkey_enrolled" &&
    !scenario.capabilities.passkeyEnrolled
  ) {
    return {
      factorId: factor.factorId,
      state: "unavailable",
      reasonCode: factor.unavailableReason.reasonCode,
      reason: factor.unavailableReason.reason,
      assurance: factor.assurance,
    };
  }

  // 3. Assurance gate: does the factor meet the required assurance?
  if (factor.assurance < scenario.requiredAssurance) {
    return {
      factorId: factor.factorId,
      state: "excluded",
      reasonCode: factor.assuranceBelowReason.reasonCode,
      reason: factor.assuranceBelowReason.reason,
      assurance: factor.assurance,
    };
  }

  // 4. Otherwise eligible.
  return {
    factorId: factor.factorId,
    state: "eligible",
    reasonCode: factor.eligibleReason.reasonCode,
    reason: factor.eligibleReason.reason,
    assurance: factor.assurance,
  };
}
