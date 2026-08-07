/**
 * Generic factor-eligibility evaluation (EXECUTION_new2.md §4.5, Phase 1).
 *
 * This module is the correctness proof of the plan: it contains **no
 * factor-specific branch**. There is no `if factorId === "SMS_OTP"` anywhere.
 * Every outcome derives from the declarative FactorDefinition:
 *
 *   1. INELIGIBLE if any trust requirement fails (state below minimum)
 *   2. UNAVAILABLE if trust is acceptable but a capability is missing
 *   3. INELIGIBLE if the assurance level is below the required minimum
 *   4. ELIGIBLE otherwise
 *
 * Failed requirements carry kind, actual/required state, evidence refs, rule
 * refs, and a reason code — everything the UI, diff, and remediation need.
 */
import type {
  AssuranceLevel,
  CapabilityState,
  EvidenceItem,
  FactorDefinition,
  FactorEvaluation,
  FailedRequirement,
  TrustAssessment,
} from "@mfa/contracts";
import { assuranceAtLeast, trustAtLeast } from "./order.js";

export interface FactorEvaluationInput {
  factor: FactorDefinition;
  trust: TrustAssessment[];
  capabilities: CapabilityState[];
  requiredAssurance: AssuranceLevel;
  /** Evidence set (for requirement evidence refs). */
  evidence: EvidenceItem[];
}

export function evaluateFactorRequirements(input: FactorEvaluationInput): FactorEvaluation {
  const { factor, trust, capabilities, requiredAssurance } = input;
  const failed: FailedRequirement[] = [];

  // 1. Trust gate.
  for (const req of factor.trustRequirements) {
    const domain = trust.find((t) => t.domainId === req.domainId);
    const actual = domain?.state ?? "UNKNOWN";
    if (!trustAtLeast(actual, req.minimumState)) {
      failed.push({
        kind: "TRUST",
        requirementId: `${factor.id}__${req.domainId}`,
        actualState: actual,
        requiredState: req.minimumState,
        evidenceIds: domain?.evidenceIds ?? [],
        ruleIds: domain?.activatedRuleIds ?? [],
        reasonCode: "trust_requirement_failed",
      });
    }
  }
  if (failed.length > 0) {
    return outcome(factor, "INELIGIBLE", failed, requiredAssurance);
  }

  // 2. Capability gate (only reached when trust is acceptable).
  for (const capabilityId of factor.capabilityRequirements) {
    const capability = capabilities.find((c) => c.capabilityId === capabilityId);
    const available = capability?.available ?? false;
    if (!available) {
      failed.push({
        kind: "CAPABILITY",
        requirementId: `${factor.id}__${capabilityId}`,
        actualState: "false",
        requiredState: "true",
        evidenceIds: [],
        ruleIds: [],
        reasonCode: "capability_missing",
      });
    }
  }
  if (failed.length > 0) {
    return outcome(factor, "UNAVAILABLE", failed, requiredAssurance);
  }

  // 3. Assurance gate.
  if (!assuranceAtLeast(factor.assurance, requiredAssurance)) {
    failed.push({
      kind: "ASSURANCE",
      requirementId: `${factor.id}__assurance`,
      actualState: factor.assurance,
      requiredState: requiredAssurance,
      evidenceIds: [],
      ruleIds: [],
      reasonCode: "assurance_below_required",
    });
    return outcome(factor, "INELIGIBLE", failed, requiredAssurance);
  }

  return outcome(factor, "ELIGIBLE", [], requiredAssurance);
}

function outcome(
  factor: FactorDefinition,
  status: FactorEvaluation["status"],
  failedRequirements: FailedRequirement[],
  requiredAssurance: AssuranceLevel
): FactorEvaluation {
  return {
    factorId: factor.id,
    status,
    failedRequirements,
    assuranceSatisfied: assuranceAtLeast(factor.assurance, requiredAssurance),
    frictionTier: factor.frictionTier,
    // Filled by buildTrace after events are emitted.
    traceEventIds: [],
  };
}

/** Evaluate every enabled factor in policy order. */
export function evaluateFactors(
  factors: FactorDefinition[],
  ctx: Omit<FactorEvaluationInput, "factor">
): FactorEvaluation[] {
  return factors
    .filter((f) => f.enabled)
    .map((factor) => evaluateFactorRequirements({ ...ctx, factor }));
}
