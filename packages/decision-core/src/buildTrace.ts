/**
 * Structured causality trace (EXECUTION_new2.md §4.8, Phase 1).
 *
 * Emits a RuleTraceEvent for every evaluation step across the phases:
 * EVIDENCE_NORMALIZATION, THREAT_ASSESSMENT, TRUST_ASSESSMENT,
 * FACTOR_ELIGIBILITY, SELECTION. The causality UI, factor inspector, audit
 * view, diff, and remediation engine all consume this structure.
 *
 * The trace is a flat, ordered, append-only list; events reference their
 * inputs and outputs by id so the chain evidence -> threat -> trust ->
 * factor -> selection can be reconstructed without code.
 */
import type {
  EvidenceItem,
  FactorEvaluation,
  FactorId,
  PolicyBundle,
  RuleTraceEvent,
  ThreatAssessment,
  TrustAssessment,
} from "@mfa/contracts";

export interface TraceInput {
  evidence: EvidenceItem[];
  threats: ThreatAssessment[];
  trust: TrustAssessment[];
  factors: FactorEvaluation[];
  selectedFactorId: FactorId | null;
  policy: PolicyBundle;
}

export interface TraceResult {
  trace: RuleTraceEvent[];
  /** Trace event ids per factor (FACTOR_ELIGIBILITY events). */
  factorEventIds: Record<FactorId, string[]>;
}

export function buildTrace(input: TraceInput): TraceResult {
  const events: RuleTraceEvent[] = [];
  const factorEventIds: Record<string, string[]> = {};
  let sequence = 0;

  const emit = (
    phase: RuleTraceEvent["phase"],
    ruleId: string,
    explanationCode: string,
    inputRefs: string[],
    outputRefs: string[]
  ): string => {
    const id = `tr_${sequence}`;
    events.push({
      id,
      phase,
      ruleId,
      ruleVersion: input.policy.version,
      inputRefs,
      outputRefs,
      explanationCode,
      sequence,
    });
    sequence += 1;
    return id;
  };

  // Evidence normalization.
  for (const ev of input.evidence) {
    emit(
      "EVIDENCE_NORMALIZATION",
      "ev_norm",
      `evidence_${ev.status.toLowerCase()}`,
      [ev.id],
      [ev.id]
    );
  }

  // Threat assessment: one event per activated rule.
  for (const threat of input.threats) {
    for (const ruleId of threat.activatedRuleIds) {
      emit(
        "THREAT_ASSESSMENT",
        ruleId,
        `threat_support_${threat.support.toLowerCase()}`,
        [...threat.supportingEvidenceIds, ...threat.conflictingEvidenceIds],
        [threat.threatId]
      );
    }
  }

  // Trust assessment: one event per activated impact rule.
  for (const domain of input.trust) {
    for (const ruleId of domain.activatedRuleIds) {
      emit(
        "TRUST_ASSESSMENT",
        ruleId,
        `trust_${domain.state.toLowerCase()}`,
        domain.evidenceIds,
        [domain.domainId]
      );
    }
  }

  // Factor eligibility: one event per factor with its outcome.
  for (const factor of input.factors) {
    const ids: string[] = [];
    for (const req of factor.failedRequirements) {
      ids.push(
        emit(
          "FACTOR_ELIGIBILITY",
          `${factor.factorId}.${req.kind.toLowerCase()}`,
          req.reasonCode,
          req.evidenceIds,
          [factor.factorId]
        )
      );
    }
    if (factor.status === "ELIGIBLE") {
      ids.push(
        emit(
          "FACTOR_ELIGIBILITY",
          `${factor.factorId}.eligible`,
          "factor_eligible",
          [],
          [factor.factorId]
        )
      );
    }
    factorEventIds[factor.factorId] = ids;
  }

  // Selection.
  emit(
    "SELECTION",
    "selection",
    input.selectedFactorId ? "factor_selected" : "assisted_recovery",
    input.selectedFactorId ? [input.selectedFactorId] : [],
    input.selectedFactorId ? [input.selectedFactorId] : []
  );

  return { trace: events, factorEventIds };
}
