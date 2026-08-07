/**
 * Policy-bundle contracts (EXECUTION_new2.md §4.7).
 *
 * A policy bundle is immutable data: versioned risk, threat, and trust-impact
 * rules plus the declarative factor catalog and selection policy. Active
 * bundles are content-hashed and every decision references bundle id, version,
 * and hash. Rules are declarative predicates — no code in policy data.
 */
import { z } from "zod";
import { EVIDENCE_TYPES } from "./evidence.js";
import { THREAT_IDS } from "./threats.js";
import { RISK_LEVELS } from "./decisions.js";
import { ASSURANCE_LEVELS, FACTOR_IDS, zFactorDefinition } from "./factors.js";

export const POLICY_STATUSES = ["DRAFT", "ACTIVE", "RETIRED"] as const;
export type PolicyStatus = (typeof POLICY_STATUSES)[number];

export const PREDICATE_OPS = ["EQ", "NEQ", "EXISTS"] as const;
export type PredicateOp = (typeof PREDICATE_OPS)[number];

export const THREAT_RULE_KINDS = ["PRIMARY", "SUPPORTING", "CONFLICTING"] as const;
export type ThreatRuleKind = (typeof THREAT_RULE_KINDS)[number];

export const TRUST_IMPACTS = ["DISTRUST", "DEGRADE"] as const;
export type TrustImpact = (typeof TRUST_IMPACTS)[number];

export const RISK_SEVERITIES = ["HIGH", "MEDIUM"] as const;
export type RiskSeverity = (typeof RISK_SEVERITIES)[number];

/** A declarative evidence predicate: `evidenceType` value compared via `op`. */
export const zEvidencePredicate = z.object({
  evidenceType: z.enum(EVIDENCE_TYPES),
  op: z.enum(PREDICATE_OPS),
  value: z.union([z.boolean(), z.number(), z.string(), z.null()]).optional(),
});
export type EvidencePredicate = z.infer<typeof zEvidencePredicate>;

export const zRiskRule = z.object({
  id: z.string().min(1),
  predicate: zEvidencePredicate,
  severity: z.enum(RISK_SEVERITIES),
  reasonCode: z.string().min(1),
});
export type RiskRule = z.infer<typeof zRiskRule>;

export const zThreatRule = z.object({
  id: z.string().min(1),
  threatId: z.enum(THREAT_IDS),
  kind: z.enum(THREAT_RULE_KINDS),
  predicate: zEvidencePredicate,
  /**
   * Primary rules only count fresh (ACTIVE) evidence. Optional: the
   * engine structurally enforces freshness for PRIMARY rules regardless.
   */
  requireFresh: z.boolean().optional(),
});
export type ThreatRule = z.infer<typeof zThreatRule>;

export const zTrustImpactRule = z.object({
  id: z.string().min(1),
  threatId: z.enum(THREAT_IDS),
  domainId: z.enum(["SIM_OWNERSHIP", "TELECOM_DELIVERY", "DEVICE_INTEGRITY",
    "CREDENTIAL_INTEGRITY", "ORIGIN_BINDING", "SESSION_INTEGRITY",
    "USER_VERIFICATION", "KNOWLEDGE_SECRECY", "NETWORK_AVAILABILITY"] as const),
  impact: z.enum(TRUST_IMPACTS),
});
export type TrustImpactRule = z.infer<typeof zTrustImpactRule>;

export const zSelectionPolicy = z.object({
  requiredAssuranceByRisk: z.record(z.enum(RISK_LEVELS), z.enum(ASSURANCE_LEVELS)),
  tieBreaker: z.array(z.enum(FACTOR_IDS)),
});
export type SelectionPolicy = z.infer<typeof zSelectionPolicy>;

export const zPolicyBundle = z.object({
  id: z.string().min(1),
  version: z.string().min(1),
  contentHash: z.string().min(1),
  status: z.enum(POLICY_STATUSES),
  riskRules: z.array(zRiskRule),
  threatRules: z.array(zThreatRule),
  trustImpactRules: z.array(zTrustImpactRule),
  factorDefinitions: z.array(zFactorDefinition),
  selectionPolicy: zSelectionPolicy,
  createdAt: z.string().min(1),
});
export type PolicyBundle = z.infer<typeof zPolicyBundle>;
