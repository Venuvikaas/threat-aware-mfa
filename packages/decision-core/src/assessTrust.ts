/**
 * Trust-state propagation (EXECUTION_new2.md §4.3, Phase 1).
 *
 * Ordinal trust across explicit trust domains, derived from *assessed*
 * threats (never from raw evidence directly):
 *
 *   STRONG threat   -> apply the declared impact (DISTRUST or DEGRADE)
 *   MODERATE threat -> apply DEGRADE
 *   WEAK / UNSUPPORTED -> no impact
 *
 * Precedence for a domain: DISTRUSTED wins over DEGRADED; otherwise TRUSTED.
 * UNKNOWN is emitted only when the domain carries no impact and no evidence
 * has been seen at all (conservative unknown, never an optimistic default).
 */
import type {
  EvidenceItem,
  PolicyBundle,
  ThreatAssessment,
  TrustAssessment,
  TrustDomainId,
  TrustState,
} from "@mfa/contracts";
import { TRUST_DOMAIN_IDS } from "@mfa/contracts";

interface ImpactAccumulator {
  state: TrustState;
  evidenceIds: string[];
  threatIds: string[];
  ruleIds: string[];
}

export function assessTrust(
  threats: ThreatAssessment[],
  evidence: EvidenceItem[],
  policy: PolicyBundle
): TrustAssessment[] {
  return TRUST_DOMAIN_IDS.map((domainId) => {
    const acc = accumulateDomain(domainId, threats, evidence, policy);
    return {
      domainId,
      state: acc.state,
      evidenceIds: acc.evidenceIds,
      threatIds: acc.threatIds,
      activatedRuleIds: acc.ruleIds,
    };
  });
}

function accumulateDomain(
  domainId: TrustDomainId,
  threats: ThreatAssessment[],
  evidence: EvidenceItem[],
  policy: PolicyBundle
): ImpactAccumulator {
  const rules = policy.trustImpactRules.filter((r) => r.domainId === domainId);
  const acc: ImpactAccumulator = {
    state: "TRUSTED",
    evidenceIds: [],
    threatIds: [],
    ruleIds: [],
  };

  for (const rule of rules) {
    const threat = threats.find((t) => t.threatId === rule.threatId);
    if (!threat || threat.support === "UNSUPPORTED" || threat.support === "WEAK") continue;

    const impact: TrustState = rule.impact === "DISTRUST" ? "DISTRUSTED" : "DEGRADED";
    acc.state = impact === "DISTRUSTED" || acc.state === "DISTRUSTED" ? "DISTRUSTED" : "DEGRADED";
    acc.evidenceIds = [...new Set([...acc.evidenceIds, ...threat.supportingEvidenceIds, ...threat.conflictingEvidenceIds])];
    acc.threatIds = [...new Set([...acc.threatIds, threat.threatId])];
    acc.ruleIds = [...new Set([...acc.ruleIds, rule.id])];
  }

  // No impact and no evidence at all -> UNKNOWN (conservative).
  if (acc.state === "TRUSTED" && acc.ruleIds.length === 0 && evidence.length === 0) {
    acc.state = "UNKNOWN";
  }

  return acc;
}
