/**
 * Independent threat assessment (EXECUTION_new2.md §4.2, Phase 1).
 *
 * Each supported threat is assessed independently — hypotheses coexist and
 * never form a normalized distribution. Support bands (STRONG / MODERATE /
 * WEAK / UNSUPPORTED) are derived from primary, supporting, and conflicting
 * evidence rules:
 *
 *   STRONG   : fresh primary AND ≥1 fresh supporting
 *   MODERATE : fresh primary only, or ≥2 fresh supporting (no primary)
 *   WEAK     : only stale primary, or a single fresh supporting
 *   UNSUPPORTED : no primary/supporting, or conflicting evidence outweighs
 *
 * A stale primary can never produce STRONG/MODERATE. A fresh conflicting
 * evidence suppresses the hypothesis to UNSUPPORTED unless a fresh primary
 * also exists.
 */
import type {
  EvidenceItem,
  PolicyBundle,
  ThreatAssessment,
  ThreatId,
  ThreatRule,
} from "@mfa/contracts";
import { matchingEvidenceIds, evaluatePredicate } from "./predicates.js";

export type ThreatOutcome = Omit<ThreatAssessment, "threatId">;

export function assessThreats(
  evidence: EvidenceItem[],
  policy: PolicyBundle
): ThreatAssessment[] {
  const threatIds = [...new Set(policy.threatRules.map((r) => r.threatId))];
  return threatIds.map((threatId) => ({
    threatId,
    ...assessThreat(threatId, policy.threatRules.filter((r) => r.threatId === threatId), evidence),
  }));
}

export function assessThreat(
  _threatId: ThreatId,
  rules: ThreatRule[],
  evidence: EvidenceItem[]
): ThreatOutcome {
  const primary = rules.filter((r) => r.kind === "PRIMARY");
  const supporting = rules.filter((r) => r.kind === "SUPPORTING");
  const conflicting = rules.filter((r) => r.kind === "CONFLICTING");

  const freshPrimary = primary.filter((r) => evaluatePredicate(r.predicate, evidence, true));
  const stalePrimary = primary.filter(
    (r) =>
      !freshPrimary.includes(r) && evaluatePredicate(r.predicate, evidence, false)
  );
  const freshSupporting = supporting.filter((r) => evaluatePredicate(r.predicate, evidence, true));
  const freshConflicting = conflicting.filter((r) => evaluatePredicate(r.predicate, evidence, true));

  const supportingIds = [
    ...new Set(freshSupporting.flatMap((r) => matchingEvidenceIds(r.predicate, evidence, true))),
  ].sort();
  const conflictingIds = [
    ...new Set(freshConflicting.flatMap((r) => matchingEvidenceIds(r.predicate, evidence, true))),
  ].sort();
  const activatedRuleIds = [
    ...new Set([
      ...freshPrimary.map((r) => r.id),
      ...stalePrimary.map((r) => r.id),
      ...freshSupporting.map((r) => r.id),
      ...freshConflicting.map((r) => r.id),
    ]),
  ];

  // A fresh conflicting evidence suppresses the hypothesis unless a fresh
  // primary exists (docs/THREAT_MODEL.md freshness rule).
  if (freshConflicting.length > 0 && freshPrimary.length === 0) {
    return {
      support: "UNSUPPORTED",
      supportingEvidenceIds: supportingIds,
      conflictingEvidenceIds: conflictingIds,
      activatedRuleIds,
    };
  }

  if (freshPrimary.length > 0) {
    const support = freshSupporting.length > 0 ? "STRONG" : "MODERATE";
    return {
      support,
      supportingEvidenceIds: supportingIds,
      conflictingEvidenceIds: conflictingIds,
      activatedRuleIds,
    };
  }

  if (stalePrimary.length > 0) {
    // Stale primary evidence can never produce STRONG or MODERATE support.
    return {
      support: "WEAK",
      supportingEvidenceIds: supportingIds,
      conflictingEvidenceIds: conflictingIds,
      activatedRuleIds,
    };
  }

  if (freshSupporting.length >= 2) {
    return {
      support: "MODERATE",
      supportingEvidenceIds: supportingIds,
      conflictingEvidenceIds: conflictingIds,
      activatedRuleIds,
    };
  }

  if (freshSupporting.length === 1) {
    return {
      support: "WEAK",
      supportingEvidenceIds: supportingIds,
      conflictingEvidenceIds: conflictingIds,
      activatedRuleIds,
    };
  }

  return {
    support: "UNSUPPORTED",
    supportingEvidenceIds: supportingIds,
    conflictingEvidenceIds: conflictingIds,
    activatedRuleIds,
  };
}
