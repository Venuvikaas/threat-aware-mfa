/**
 * Structured causality-trace contracts (EXECUTION_new2.md §4.8).
 *
 * Every evaluation phase emits rule trace events; the causality UI, factor
 * inspector, diff, and remediation engine all consume this structure.
 */
import { z } from "zod";

export const TRACE_PHASES = [
  "EVIDENCE_NORMALIZATION",
  "THREAT_ASSESSMENT",
  "TRUST_ASSESSMENT",
  "FACTOR_ELIGIBILITY",
  "SELECTION",
  "CHALLENGE",
  "OUTCOME",
] as const;
export type TracePhase = (typeof TRACE_PHASES)[number];

export const zRuleTraceEvent = z.object({
  id: z.string().min(1),
  phase: z.enum(TRACE_PHASES),
  ruleId: z.string().min(1),
  ruleVersion: z.string().min(1),
  inputRefs: z.array(z.string()),
  outputRefs: z.array(z.string()),
  explanationCode: z.string().min(1),
  sequence: z.number().int().nonnegative(),
});
export type RuleTraceEvent = z.infer<typeof zRuleTraceEvent>;

export const zTraceTimeline = z.array(zRuleTraceEvent);
