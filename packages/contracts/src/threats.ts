/**
 * Threat-assessment contracts (EXECUTION_new2.md §4.2).
 *
 * Threats are assessed independently — they never form a normalized
 * distribution. Each assessment cites supporting and conflicting evidence
 * plus the activated rules that produced it.
 */
import { z } from "zod";

export const THREAT_IDS = [
  "SIM_CHANNEL_COMPROMISE",
  "PHISHING_RELAY",
  "DEVICE_INTEGRITY_CONCERN",
] as const;
export type ThreatId = (typeof THREAT_IDS)[number];

export const THREAT_SUPPORTS = ["STRONG", "MODERATE", "WEAK", "UNSUPPORTED"] as const;
export type ThreatSupport = (typeof THREAT_SUPPORTS)[number];

export const zThreatAssessment = z.object({
  threatId: z.enum(THREAT_IDS),
  support: z.enum(THREAT_SUPPORTS),
  supportingEvidenceIds: z.array(z.string()),
  conflictingEvidenceIds: z.array(z.string()),
  activatedRuleIds: z.array(z.string()),
});
export type ThreatAssessment = z.infer<typeof zThreatAssessment>;
