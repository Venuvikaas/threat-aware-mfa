/**
 * Factor catalog and evaluation contracts (EXECUTION_new2.md §4.4–4.6).
 *
 * Factors are declared data: trust requirements, capability requirements,
 * assurance level, friction tier, and an adapter id. Evaluation is generic —
 * the engine contains no factor-specific branches.
 */
import { z } from "zod";
import { TRUST_DOMAIN_IDS } from "./trust.js";

export const FACTOR_IDS = ["SMS_OTP", "PASSKEY", "TOTP", "PIN"] as const;
export type FactorId = (typeof FACTOR_IDS)[number];

export const ASSURANCE_LEVELS = ["AAL1", "AAL2", "AAL3"] as const;
export type AssuranceLevel = (typeof ASSURANCE_LEVELS)[number];

export const FRICTION_TIERS = ["LOW", "MEDIUM", "HIGH"] as const;
export type FrictionTier = (typeof FRICTION_TIERS)[number];

export const FACTOR_STATUSES = ["ELIGIBLE", "INELIGIBLE", "UNAVAILABLE"] as const;
export type FactorStatus = (typeof FACTOR_STATUSES)[number];

export const MINIMUM_TRUST_STATES = ["TRUSTED", "DEGRADED"] as const;
export type MinimumTrustState = (typeof MINIMUM_TRUST_STATES)[number];

export const zTrustRequirement = z.object({
  domainId: z.enum(TRUST_DOMAIN_IDS),
  minimumState: z.enum(MINIMUM_TRUST_STATES),
  rationaleCode: z.string().min(1),
});
export type TrustRequirement = z.infer<typeof zTrustRequirement>;

export const zFactorDefinition = z.object({
  id: z.enum(FACTOR_IDS),
  displayName: z.string().min(1),
  assurance: z.enum(ASSURANCE_LEVELS),
  trustRequirements: z.array(zTrustRequirement),
  capabilityRequirements: z.array(z.string().min(1)),
  frictionTier: z.enum(FRICTION_TIERS),
  adapterId: z.string().min(1),
  enabled: z.boolean(),
});
export type FactorDefinition = z.infer<typeof zFactorDefinition>;

export const FAILURE_KINDS = ["TRUST", "CAPABILITY", "ASSURANCE"] as const;
export type FailureKind = (typeof FAILURE_KINDS)[number];

export const zFailedRequirement = z.object({
  kind: z.enum(FAILURE_KINDS),
  requirementId: z.string().min(1),
  actualState: z.string(),
  requiredState: z.string(),
  evidenceIds: z.array(z.string()),
  ruleIds: z.array(z.string()),
  reasonCode: z.string().min(1),
});
export type FailedRequirement = z.infer<typeof zFailedRequirement>;

export const zFactorEvaluation = z.object({
  factorId: z.enum(FACTOR_IDS),
  status: z.enum(FACTOR_STATUSES),
  failedRequirements: z.array(zFailedRequirement),
  assuranceSatisfied: z.boolean(),
  frictionTier: z.enum(FRICTION_TIERS),
  traceEventIds: z.array(z.string()),
});
export type FactorEvaluation = z.infer<typeof zFactorEvaluation>;
