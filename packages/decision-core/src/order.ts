/**
 * Ordinal comparison helpers (EXECUTION_new2.md §4.3–4.6).
 *
 * Trust, assurance, and friction are ordered categories — never percentages.
 * The evaluator compares them with these rank tables.
 */
import type { AssuranceLevel, FrictionTier, TrustState } from "@mfa/contracts";

/** Higher rank = more trusted. UNKNOWN (no signal) ranks below DISTRUSTED. */
const TRUST_RANK: Record<TrustState, number> = {
  UNKNOWN: 0,
  DISTRUSTED: 1,
  DEGRADED: 2,
  TRUSTED: 3,
};

export function trustAtLeast(state: TrustState, minimum: TrustState): boolean {
  return TRUST_RANK[state] >= TRUST_RANK[minimum];
}

const ASSURANCE_RANK: Record<AssuranceLevel, number> = {
  AAL1: 1,
  AAL2: 2,
  AAL3: 3,
};

export function assuranceAtLeast(state: AssuranceLevel, minimum: AssuranceLevel): boolean {
  return ASSURANCE_RANK[state] >= ASSURANCE_RANK[minimum];
}

const FRICTION_RANK: Record<FrictionTier, number> = {
  LOW: 0,
  MEDIUM: 1,
  HIGH: 2,
};

export function frictionRank(tier: FrictionTier): number {
  return FRICTION_RANK[tier];
}
