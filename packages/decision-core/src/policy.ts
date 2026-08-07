/**
 * Versioned demonstration policy (docs/EXECUTION.md Phase 2).
 *
 * Thresholds are categorical, deterministic, and committed. The engines take
 * this policy as an explicit argument so they stay pure.
 */
export interface DecisionPolicy {
  version: string;
  /** Money is integer minor units — ₹50,000. */
  highValueAmountMinor: number;
  /** A login distance beyond this is a large geo jump. */
  largeGeoDistanceKm: number;
  /** At least this many recent failed logins is repeated. */
  failedLoginThreshold: number;
  /** A session younger than this is considered unusual. */
  unusualSessionAgeSeconds: number;
}

export const DEMO_POLICY: DecisionPolicy = {
  version: "2026.08.0",
  highValueAmountMinor: 5_000_000,
  largeGeoDistanceKm: 500,
  failedLoginThreshold: 2,
  unusualSessionAgeSeconds: 300,
};
