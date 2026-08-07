/**
 * Deterministic factor selection (EXECUTION_new2.md §4.6, Phase 1).
 *
 * Selection order: trust-compatible -> capability-compatible ->
 * assurance-qualified (all already reflected in FactorEvaluation.status) ->
 * lowest friction tier -> configured deterministic tie-breaker.
 *
 * There is no highest-assurance-first behavior after the minimum assurance
 * is met: among eligible factors, friction (then tie-breaker) decides.
 */
import type { FactorDefinition, FactorEvaluation, FactorId, PolicyBundle } from "@mfa/contracts";
import { frictionRank } from "./order.js";

export function selectFactor(
  evaluations: FactorEvaluation[],
  factors: FactorDefinition[],
  policy: PolicyBundle
): FactorId | null {
  const eligibleIds = new Set(
    evaluations.filter((e) => e.status === "ELIGIBLE").map((e) => e.factorId)
  );
  if (eligibleIds.size === 0) return null;

  const defs = factors.filter((f) => eligibleIds.has(f.id));
  if (defs.length === 0) return null;

  const tieBreaker = policy.selectionPolicy.tieBreaker;
  const sorted = [...defs].sort((a, b) => {
    const frictionDiff = frictionRank(a.frictionTier) - frictionRank(b.frictionTier);
    if (frictionDiff !== 0) return frictionDiff;
    const aIndex = tieBreaker.indexOf(a.id);
    const bIndex = tieBreaker.indexOf(b.id);
    const tieDiff = (aIndex === -1 ? Number.MAX_SAFE_INTEGER : aIndex) -
      (bIndex === -1 ? Number.MAX_SAFE_INTEGER : bIndex);
    if (tieDiff !== 0) return tieDiff;
    return a.id.localeCompare(b.id);
  });

  return sorted[0]?.id ?? null;
}
