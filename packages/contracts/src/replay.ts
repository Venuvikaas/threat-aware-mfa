/**
 * Replay, diff, and remediation contracts (EXECUTION_new2.md §5.4–5.5).
 *
 * Exact replay proves determinism; fork replay changes only declared
 * evidence or capability inputs and never mutates the original decision.
 * Remediation is never emitted without replay verification.
 */
import { z } from "zod";
import { zEvidenceOverride } from "./evidence.js";
import { zCapabilityOverride } from "./capabilities.js";
import { FACTOR_IDS } from "./factors.js";

export const REPLAY_MODES = ["EXACT", "FORK"] as const;
export type ReplayMode = (typeof REPLAY_MODES)[number];

export const zCreateReplayRequest = z.object({
  mode: z.enum(REPLAY_MODES),
  evidenceChanges: z.array(zEvidenceOverride).optional(),
  capabilityChanges: z.array(zCapabilityOverride).optional(),
  policyVersion: z.string().optional(),
});
export type CreateReplayRequest = z.infer<typeof zCreateReplayRequest>;

export const zReplayRecord = z.object({
  replayId: z.string().min(1),
  sourceDecisionId: z.string().min(1),
  mode: z.enum(REPLAY_MODES),
  policyVersion: z.string().min(1),
  producedDecisionId: z.string().min(1),
  createdAt: z.string().min(1),
});
export type ReplayRecord = z.infer<typeof zReplayRecord>;

export const DIFF_SECTIONS = [
  "INPUT",
  "POLICY",
  "THREAT",
  "TRUST",
  "FACTOR",
  "RULE",
  "SELECTION",
] as const;
export type DiffSection = (typeof DIFF_SECTIONS)[number];

export const zDiffChange = z.object({
  path: z.string().min(1),
  before: z.unknown().optional(),
  after: z.unknown().optional(),
});
export type DiffChange = z.infer<typeof zDiffChange>;

export const zDecisionDiff = z.object({
  replayId: z.string().min(1),
  sourceDecisionId: z.string().min(1),
  identical: z.boolean(),
  sections: z.array(
    z.object({
      section: z.enum(DIFF_SECTIONS),
      changes: z.array(zDiffChange),
    })
  ),
});
export type DecisionDiff = z.infer<typeof zDecisionDiff>;

export const REMEDIATION_STATUSES = [
  "VERIFIED_ELIGIBLE",
  "VERIFIED_SELECTED",
  "REMAINS_INELIGIBLE",
] as const;
export type RemediationStatus = (typeof REMEDIATION_STATUSES)[number];

export const zRemediationChangeSet = z.object({
  capabilityChanges: z.array(zCapabilityOverride).optional(),
  evidenceChanges: z.array(zEvidenceOverride).optional(),
});
export type RemediationChangeSet = z.infer<typeof zRemediationChangeSet>;

export const zFactorRemediation = z.object({
  factorId: z.enum(FACTOR_IDS),
  status: z.enum(REMEDIATION_STATUSES),
  changeSets: z.array(zRemediationChangeSet),
  explanationCode: z.string().min(1),
});
export type FactorRemediation = z.infer<typeof zFactorRemediation>;

export const zRemediationResponse = z.object({
  decisionId: z.string().min(1),
  factorId: z.enum(FACTOR_IDS),
  verified: z.boolean(),
  wouldBecomeEligible: z.boolean(),
  wouldBeSelected: z.boolean(),
  changeSets: z.array(zRemediationChangeSet),
});
export type RemediationResponse = z.infer<typeof zRemediationResponse>;
