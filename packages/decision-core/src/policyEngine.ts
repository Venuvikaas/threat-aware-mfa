/**
 * Policy engine (docs/EXECUTION.md Phase 2).
 *
 * Evaluation order (PART 5.3):
 *   1. Load user factor enrollment.
 *   2. Load required assurance from transaction policy.
 *   3. Block threat-incompatible factors.
 *   4. Mark unenrolled factors unavailable.
 *   5. Retain factors meeting the assurance requirement.
 *   6. Select the first allowed factor in fixed preference order.
 *   7. If none survives, return assisted recovery.
 */
import type {
  DecisionAction,
  FactorDecision,
  FactorId,
  FactorStatus,
  RiskLevel,
  ThreatType,
} from "@mfa/contracts";
import {
  FACTOR_PREFERENCE_ORDER,
  FACTOR_REGISTRY,
  requiredAssuranceForRisk,
} from "./factorRegistry.js";

export interface PolicyInput {
  riskLevel: RiskLevel;
  threatType: ThreatType;
  passkeyEnrolled: boolean;
}

export interface PolicyEvaluation {
  factors: FactorDecision[];
  allowedFactors: FactorId[];
  blockedFactors: FactorId[];
  selectedFactor: FactorId | null;
  action: DecisionAction;
}

interface FactorContext {
  threatType: ThreatType;
  passkeyEnrolled: boolean;
  requiredAssurance: number;
}

export function evaluatePolicy(input: PolicyInput): PolicyEvaluation {
  const requiredAssurance = requiredAssuranceForRisk(input.riskLevel);
  const context: FactorContext = {
    threatType: input.threatType,
    passkeyEnrolled: input.passkeyEnrolled,
    requiredAssurance,
  };

  const factors = FACTOR_PREFERENCE_ORDER.map((factor) =>
    evaluateFactor(factor, context)
  );

  const allowedFactors = factors
    .filter((f) => f.status === "ALLOWED")
    .map((f) => f.factor);
  const blockedFactors = factors
    .filter((f) => f.status === "BLOCKED")
    .map((f) => f.factor);

  const selectedFactor = allowedFactors[0] ?? null;
  const action: DecisionAction = selectedFactor
    ? "ALLOW_WITH_FACTOR"
    : "REFER_TO_ASSISTED_RECOVERY";

  return {
    factors,
    allowedFactors,
    blockedFactors,
    selectedFactor,
    action,
  };
}

function evaluateFactor(
  factor: FactorId,
  ctx: FactorContext
): FactorDecision {
  // 1. Threat compatibility — blocked first, before any other state.
  if (factor === "SMS_OTP") {
    if (ctx.threatType === "SIM_CHANNEL_COMPROMISE") {
      return {
        factor,
        status: "BLOCKED",
        reasonCode: "sms_channel_untrusted",
        reason:
          "SMS channel is not trusted under the SIM-channel-compromise hypothesis.",
      };
    }
    if (ctx.threatType === "PHISHING") {
      return {
        factor,
        status: "BLOCKED",
        reasonCode: "factor_relayable",
        reason:
          "SMS one-time codes are relayable under the phishing-relay hypothesis.",
      };
    }
  }

  const definition = FACTOR_REGISTRY[factor];

  // 2. Enrollment / capability.
  if (definition.requiresEnrollment && !ctx.passkeyEnrolled) {
    return {
      factor,
      status: "UNAVAILABLE",
      reasonCode: "passkey_not_enrolled",
      reason: "Passkey is not enrolled for this user.",
    };
  }

  // 3. Assurance gate.
  if (definition.assurance < ctx.requiredAssurance) {
    return {
      factor,
      status: "BLOCKED",
      reasonCode: "assurance_too_low",
      reason: "Factor assurance is below the required level for this risk.",
    };
  }

  return {
    factor,
    status: "ALLOWED",
    reasonCode: "factor_eligible",
    reason: "Enrolled and above required assurance.",
  };
}

/** Status of a factor evaluation; used by callers to filter outcomes. */
export function isAllowed(status: FactorStatus): boolean {
  return status === "ALLOWED";
}
