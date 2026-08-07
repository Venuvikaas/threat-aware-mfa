/**
 * Decision contracts (EXECUTION_new2.md §5.1–5.2).
 *
 * The decision response carries the complete reasoning chain: normalized
 * evidence, independent threat assessments, trust states, factor
 * evaluations, the selected factor or assisted recovery, and the full
 * structured trace.
 */
import { z } from "zod";
import { zEvidenceItem, zEvidenceOverride } from "./evidence.js";
import { zThreatAssessment } from "./threats.js";
import { zTrustAssessment } from "./trust.js";
import { zFactorEvaluation, FACTOR_IDS } from "./factors.js";
import { zRuleTraceEvent } from "./trace.js";

export const RISK_LEVELS = ["LOW", "MEDIUM", "HIGH"] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];

export const DECISION_ACTIONS = ["CHALLENGE", "ASSISTED_RECOVERY"] as const;
export type DecisionAction = (typeof DECISION_ACTIONS)[number];

export const MAX_AMOUNT_MINOR = 100_000_000_00;
export const MAX_SESSION_AGE_SECONDS = 31_536_000;
export const MAX_FAILED_LOGIN_COUNT = 1000;
export const MAX_GEO_DISTANCE_KM = 40_075;

export const zCreateDecisionRequest = z.object({
  userId: z.string().min(1),
  clientTransactionId: z.string().min(1),
  transaction: z.object({
    amountMinor: z.number().int().nonnegative().max(MAX_AMOUNT_MINOR),
    currency: z.literal("INR"),
    payeeId: z.string().min(1),
    payeeIsKnown: z.boolean(),
  }),
  session: z.object({
    sessionId: z.string().min(1),
    deviceId: z.string().min(1),
    ageSeconds: z.number().nonnegative().max(MAX_SESSION_AGE_SECONDS),
    failedLoginCount: z.number().int().nonnegative().max(MAX_FAILED_LOGIN_COUNT),
    ipAddress: z.string().min(1),
    asn: z.string().min(1),
    country: z.string().min(1),
  }),
  /** Demo-only evidence overrides (same semantics as the old signals). */
  evidenceOverrides: z.array(zEvidenceOverride).optional(),
  /** Request a specific immutable policy version (defaults to active). */
  policyVersion: z.string().optional(),
});
export type CreateDecisionRequest = z.infer<typeof zCreateDecisionRequest>;

export const zDecisionResponse = z.object({
  decisionId: z.string().min(1),
  transactionId: z.string().min(1),
  policy: z.object({
    bundleId: z.string().min(1),
    version: z.string().min(1),
    contentHash: z.string().min(1),
  }),
  risk: z.object({
    level: z.enum(RISK_LEVELS),
    reasonCodes: z.array(z.string().min(1)),
  }),
  evidence: z.array(zEvidenceItem),
  threats: z.array(zThreatAssessment),
  trust: z.array(zTrustAssessment),
  factors: z.array(zFactorEvaluation),
  selectedFactorId: z.enum(FACTOR_IDS).nullable(),
  action: z.enum(DECISION_ACTIONS),
  trace: z.array(zRuleTraceEvent),
  createdAt: z.string().min(1),
}).strict(); // strict: a decision response must never carry unmodeled fields (no probabilities/percentages)
export type DecisionResponse = z.infer<typeof zDecisionResponse>;

export const zRiskResult = z.object({
  level: z.enum(RISK_LEVELS),
  reasonCodes: z.array(z.string().min(1)),
});
export type RiskResult = z.infer<typeof zRiskResult>;
