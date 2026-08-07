/**
 * Policy-bundle validation (EXECUTION_new2.md Phase 2).
 *
 * Structural validation only: rejects unknown trust-domain, capability,
 * factor, evidence-type, and threat references so a corrupt bundle can never
 * reach the engine. The engine itself assumes a validated bundle.
 */
import {
  CAPABILITY_IDS,
  EVIDENCE_TYPES,
  FACTOR_IDS,
  THREAT_IDS,
  TRUST_DOMAIN_IDS,
  type PolicyBundle,
} from "@mfa/contracts";

export interface PolicyValidationIssue {
  path: string;
  message: string;
}

export function validatePolicy(policy: PolicyBundle): PolicyValidationIssue[] {
  const issues: PolicyValidationIssue[] = [];

  if (policy.status !== "ACTIVE" && policy.status !== "DRAFT" && policy.status !== "RETIRED") {
    issues.push({ path: "status", message: `unknown status ${String(policy.status)}` });
  }

  // Risk rules: evidence types must exist.
  for (const rule of policy.riskRules) {
    if (!EVIDENCE_TYPES.includes(rule.predicate.evidenceType)) {
      issues.push({
        path: `riskRules.${rule.id}`,
        message: `unknown evidence type ${rule.predicate.evidenceType}`,
      });
    }
  }

  // Threat rules: threat ids and evidence types must exist.
  for (const rule of policy.threatRules) {
    if (!THREAT_IDS.includes(rule.threatId)) {
      issues.push({ path: `threatRules.${rule.id}`, message: `unknown threat id ${rule.threatId}` });
    }
    if (!EVIDENCE_TYPES.includes(rule.predicate.evidenceType)) {
      issues.push({
        path: `threatRules.${rule.id}`,
        message: `unknown evidence type ${rule.predicate.evidenceType}`,
      });
    }
  }

  // Trust impact rules: threat and domain references must exist.
  for (const rule of policy.trustImpactRules) {
    if (!THREAT_IDS.includes(rule.threatId)) {
      issues.push({ path: `trustImpactRules.${rule.id}`, message: `unknown threat id ${rule.threatId}` });
    }
    if (!TRUST_DOMAIN_IDS.includes(rule.domainId)) {
      issues.push({ path: `trustImpactRules.${rule.id}`, message: `unknown trust domain ${rule.domainId}` });
    }
  }

  // Factor definitions: factor ids, domains, capabilities, adapter refs.
  const seenFactorIds = new Set<string>();
  for (const factor of policy.factorDefinitions) {
    if (seenFactorIds.has(factor.id)) {
      issues.push({ path: `factorDefinitions.${factor.id}`, message: "duplicate factor id" });
    }
    seenFactorIds.add(factor.id);
    if (!FACTOR_IDS.includes(factor.id)) {
      issues.push({ path: `factorDefinitions.${factor.id}`, message: `unknown factor id ${factor.id}` });
    }
    for (const req of factor.trustRequirements) {
      if (!TRUST_DOMAIN_IDS.includes(req.domainId)) {
        issues.push({
          path: `factorDefinitions.${factor.id}.trustRequirements`,
          message: `unknown trust domain ${req.domainId}`,
        });
      }
    }
    for (const capabilityId of factor.capabilityRequirements) {
      if (!CAPABILITY_IDS.includes(capabilityId as (typeof CAPABILITY_IDS)[number])) {
        issues.push({
          path: `factorDefinitions.${factor.id}.capabilityRequirements`,
          message: `unknown capability ${capabilityId}`,
        });
      }
    }
  }

  // Selection policy: risk levels and tie-breaker factors must exist.
  for (const risk of Object.keys(policy.selectionPolicy.requiredAssuranceByRisk)) {
    if (!["LOW", "MEDIUM", "HIGH"].includes(risk)) {
      issues.push({ path: "selectionPolicy.requiredAssuranceByRisk", message: `unknown risk level ${risk}` });
    }
  }
  for (const factorId of policy.selectionPolicy.tieBreaker) {
    if (!FACTOR_IDS.includes(factorId)) {
      issues.push({ path: "selectionPolicy.tieBreaker", message: `unknown factor ${factorId}` });
    }
  }

  return issues;
}

export function assertValidPolicy(policy: PolicyBundle): void {
  const issues = validatePolicy(policy);
  if (issues.length > 0) {
    throw new Error(`Invalid policy bundle: ${issues.map((i) => `${i.path}: ${i.message}`).join("; ")}`);
  }
}
