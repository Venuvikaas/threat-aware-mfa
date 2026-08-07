/**
 * Trust-domain contracts (EXECUTION_new2.md §4.3).
 *
 * Trust is ordinal, reasoned state across explicit trust domains — never a
 * numeric percentage. States: TRUSTED, DEGRADED, DISTRUSTED, UNKNOWN.
 */
import { z } from "zod";

export const TRUST_DOMAIN_IDS = [
  "SIM_OWNERSHIP",
  "TELECOM_DELIVERY",
  "DEVICE_INTEGRITY",
  "CREDENTIAL_INTEGRITY",
  "ORIGIN_BINDING",
  "SESSION_INTEGRITY",
  "USER_VERIFICATION",
  "KNOWLEDGE_SECRECY",
  "NETWORK_AVAILABILITY",
] as const;
export type TrustDomainId = (typeof TRUST_DOMAIN_IDS)[number];

export const TRUST_STATES = ["TRUSTED", "DEGRADED", "DISTRUSTED", "UNKNOWN"] as const;
export type TrustState = (typeof TRUST_STATES)[number];

export const zTrustAssessment = z.object({
  domainId: z.enum(TRUST_DOMAIN_IDS),
  state: z.enum(TRUST_STATES),
  evidenceIds: z.array(z.string()),
  threatIds: z.array(z.string()),
  activatedRuleIds: z.array(z.string()),
});
export type TrustAssessment = z.infer<typeof zTrustAssessment>;
