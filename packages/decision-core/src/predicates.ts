/**
 * Declarative evidence-predicate evaluation (EXECUTION_new2.md §4.7).
 *
 * Both risk rules and threat rules are predicates over evidence. Matching is
 * generic — no rule knows anything about a specific factor.
 */
import type { EvidenceItem, EvidencePredicate } from "@mfa/contracts";

/**
 * Evaluate a predicate against an evidence set. `freshOnly` restricts
 * matching to ACTIVE evidence (used by primary threat rules, which must never
 * be satisfied by stale observations).
 */
export function evaluatePredicate(
  predicate: EvidencePredicate,
  evidence: EvidenceItem[],
  freshOnly = false
): boolean {
  const candidates = evidence.filter(
    (e) => e.type === predicate.evidenceType && (!freshOnly || e.status === "ACTIVE")
  );
  if (candidates.length === 0) return false;

  switch (predicate.op) {
    case "EQ":
      return candidates.some((e) => e.value === predicate.value);
    case "NEQ":
      return candidates.some((e) => e.value !== predicate.value);
    case "EXISTS":
      return candidates.length > 0;
  }
}

/** Evidence ids matching a predicate (for trace references). */
export function matchingEvidenceIds(
  predicate: EvidencePredicate,
  evidence: EvidenceItem[],
  freshOnly = false
): string[] {
  return evidence
    .filter((e) => e.type === predicate.evidenceType && (!freshOnly || e.status === "ACTIVE"))
    .map((e) => e.id)
    .sort();
}
