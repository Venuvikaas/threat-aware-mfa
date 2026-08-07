/**
 * Frozen wire contracts for the Threat-Aware Authentication Decision Service
 * (EXECUTION_new2.md §5).
 *
 * Split by domain: evidence, threats, trust, factors, policy, trace,
 * decisions, replay. Runtime validation and static types share one source of
 * truth and cannot drift apart.
 */
import { z } from "zod";

export * from "./evidence.js";
export * from "./threats.js";
export * from "./trust.js";
export * from "./factors.js";
export * from "./capabilities.js";
export * from "./policy.js";
export * from "./trace.js";
export * from "./decisions.js";
export * from "./replay.js";

/* ------------------------------------------------------------------ */
/* Factor challenge (Phase 4; shape carried over from the prior build) */
/* ------------------------------------------------------------------ */

export const zCreateChallengeRequest = z.object({
  decisionId: z.string().min(1),
  factor: z.enum(FACTOR_IDS),
  /**
   * Demo-only hint: create the labeled SIMULATED challenge even when a real
   * WebAuthn ceremony would be possible. Rejected outside demo mode.
   */
  preferSimulated: z.boolean().optional(),
});
export type CreateChallengeRequest = z.infer<typeof zCreateChallengeRequest>;

export const CHALLENGE_MODES = ["SIMULATED", "WEBAUTHN"] as const;
export type ChallengeMode = (typeof CHALLENGE_MODES)[number];

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

export const TRANSACTION_STATUSES = [
  "AUTHORIZED",
  "DENIED",
  "PENDING_RECOVERY",
] as const;
export type TransactionStatus = (typeof TRANSACTION_STATUSES)[number];

export const zVerifyChallengeResponse = z.object({
  challengeId: z.string().min(1),
  verified: z.boolean(),
  transactionStatus: z.enum(TRANSACTION_STATUSES),
});
export type VerifyChallengeResponse = z.infer<typeof zVerifyChallengeResponse>;

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
  REPLAY: "REPLAY_ERROR",
  PAYLOAD_TOO_LARGE: "PAYLOAD_TOO_LARGE",
  RATE_LIMITED: "RATE_LIMITED",
  INTERNAL: "INTERNAL_ERROR",
} as const;

// Local import to keep the challenge schemas self-contained.
import { FACTOR_IDS } from "./factors.js";
