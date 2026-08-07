/**
 * Frozen API contracts for the Threat-Aware MFA Decision Service.
 *
 * These types and Zod schemas are the single source of truth for the wire
 * contract between apps/api and apps/web. They are frozen at Phase 0 and any
 * change must be deliberate (docs/EXECUTION.md PART 3).
 *
 * Every interface below mirrors the frozen contract exactly; the Zod schemas
 * are derived from the same shapes so runtime validation and static typing
 * cannot drift apart.
 */
import { z } from "zod";

/* ------------------------------------------------------------------ */
/* Vocabulary                                                          */
/* ------------------------------------------------------------------ */

export const RISK_LEVELS = ["LOW", "MEDIUM", "HIGH"] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];

export const THREAT_TYPES = [
  "SIM_CHANNEL_COMPROMISE",
  "PHISHING",
  "INSUFFICIENT_EVIDENCE",
] as const;
export type ThreatType = (typeof THREAT_TYPES)[number];

export const THREAT_SUPPORT = ["HIGH", "MODERATE", "INSUFFICIENT"] as const;
export type ThreatSupport = (typeof THREAT_SUPPORT)[number];

export const FACTOR_IDS = ["PASSKEY", "SMS_OTP"] as const;
export type FactorId = (typeof FACTOR_IDS)[number];

export const FACTOR_STATUSES = ["ALLOWED", "BLOCKED", "UNAVAILABLE"] as const;
export type FactorStatus = (typeof FACTOR_STATUSES)[number];

export const DECISION_ACTIONS = [
  "ALLOW_WITH_FACTOR",
  "REFER_TO_ASSISTED_RECOVERY",
] as const;
export type DecisionAction = (typeof DECISION_ACTIONS)[number];

export const CHALLENGE_MODES = ["SIMULATED", "WEBAUTHN"] as const;
export type ChallengeMode = (typeof CHALLENGE_MODES)[number];

export const TRANSACTION_STATUSES = [
  "AUTHORIZED",
  "DENIED",
  "PENDING_RECOVERY",
] as const;
export type TransactionStatus = (typeof TRANSACTION_STATUSES)[number];

export const AUDIT_EVENT_TYPES = [
  "DECISION_CREATED",
  "FACTOR_BLOCKED",
  "FACTOR_SELECTED",
  "CHALLENGE_CREATED",
  "CHALLENGE_VERIFIED",
  "RECOVERY_REQUIRED",
] as const;
export type AuditEventType = (typeof AUDIT_EVENT_TYPES)[number];

/* ------------------------------------------------------------------ */
/* Decision request / response                                        */
/* ------------------------------------------------------------------ */

export const zCurrency = z.literal("INR");

export const zCreateDecisionRequest = z.object({
  userId: z.string().min(1),
  transaction: z.object({
    clientTransactionId: z.string().min(1),
    amountMinor: z.number().int().nonnegative(),
    currency: zCurrency,
    payeeId: z.string().min(1),
    payeeIsKnown: z.boolean(),
  }),
  session: z.object({
    sessionId: z.string().min(1),
    ageSeconds: z.number().nonnegative(),
    failedLoginCount: z.number().int().nonnegative(),
    ipAddress: z.string().min(1),
    asn: z.string().min(1),
    country: z.string().min(1),
  }),
  device: z.object({
    deviceId: z.string().min(1),
    trusted: z.boolean(),
    firstSeen: z.boolean(),
    browserFingerprint: z.string().min(1),
  }),
  signals: z.object({
    recentSimChange: z.boolean().nullable(),
    geoDistanceFromLastLoginKm: z.number().nonnegative().nullable(),
    phishingRelayIndicator: z.boolean(),
  }),
});
export type CreateDecisionRequest = z.infer<typeof zCreateDecisionRequest>;

export const zFactorDecision = z.object({
  factor: z.enum(FACTOR_IDS),
  status: z.enum(FACTOR_STATUSES),
  reasonCode: z.string().min(1),
  reason: z.string().min(1),
});
export type FactorDecision = z.infer<typeof zFactorDecision>;

export const zCreateDecisionResponse = z.object({
  decisionId: z.string().min(1),
  transactionId: z.string().min(1),
  policyVersion: z.string().min(1),
  risk: z.object({
    level: z.enum(RISK_LEVELS),
    reasons: z.array(z.string().min(1)),
  }),
  threat: z.object({
    type: z.enum(THREAT_TYPES),
    support: z.enum(THREAT_SUPPORT),
    evidence: z.array(z.string().min(1)),
  }),
  factors: z.array(zFactorDecision),
  allowedFactors: z.array(z.enum(FACTOR_IDS)),
  blockedFactors: z.array(z.enum(FACTOR_IDS)),
  selectedFactor: z.enum(FACTOR_IDS).nullable(),
  action: z.enum(DECISION_ACTIONS),
  createdAt: z.string().min(1),
});
export type CreateDecisionResponse = z.infer<typeof zCreateDecisionResponse>;

/* ------------------------------------------------------------------ */
/* Factor challenge                                                    */
/* ------------------------------------------------------------------ */

export const zCreateChallengeRequest = z.object({
  decisionId: z.string().min(1),
  factor: z.enum(FACTOR_IDS),
});
export type CreateChallengeRequest = z.infer<typeof zCreateChallengeRequest>;

export const zCreateChallengeResponse = z.object({
  challengeId: z.string().min(1),
  factor: z.enum(FACTOR_IDS),
  mode: z.enum(CHALLENGE_MODES),
  expiresAt: z.string().min(1),
  publicOptions: z.unknown().optional(),
});
export type CreateChallengeResponse = z.infer<typeof zCreateChallengeResponse>;

export const zVerifyChallengeRequest = z.object({
  challengeId: z.string().min(1),
  response: z.unknown(),
});
export type VerifyChallengeRequest = z.infer<typeof zVerifyChallengeRequest>;

export const zVerifyChallengeResponse = z.object({
  challengeId: z.string().min(1),
  verified: z.boolean(),
  transactionStatus: z.enum(TRANSACTION_STATUSES),
});
export type VerifyChallengeResponse = z.infer<typeof zVerifyChallengeResponse>;

/* ------------------------------------------------------------------ */
/* Audit                                                               */
/* ------------------------------------------------------------------ */

export const zAuditEvent = z.object({
  id: z.string().min(1),
  decisionId: z.string().min(1),
  eventType: z.enum(AUDIT_EVENT_TYPES),
  reasonCode: z.string().min(1),
  details: z.record(z.string(), z.unknown()),
  createdAt: z.string().min(1),
});
export type AuditEvent = z.infer<typeof zAuditEvent>;

export const zAuditTimeline = z.array(zAuditEvent);

/* ------------------------------------------------------------------ */
/* Errors                                                              */
/* ------------------------------------------------------------------ */

export const zErrorResponse = z.object({
  error: z.object({
    code: z.string().min(1),
    message: z.string().min(1),
    details: z.unknown().optional(),
  }),
});
export type ErrorResponse = z.infer<typeof zErrorResponse>;

/** Stable error codes the API may return. */
export const ERROR_CODES = {
  VALIDATION: "VALIDATION_ERROR",
  NOT_FOUND: "NOT_FOUND",
  CONFLICT: "CONFLICT",
  POLICY: "POLICY_REJECTION",
  CHALLENGE: "CHALLENGE_ERROR",
  PAYLOAD_TOO_LARGE: "PAYLOAD_TOO_LARGE",
  RATE_LIMITED: "RATE_LIMITED",
  INTERNAL: "INTERNAL_ERROR",
} as const;
