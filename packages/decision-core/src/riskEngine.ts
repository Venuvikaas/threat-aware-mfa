/**
 * Risk engine (docs/EXECUTION.md Phase 2).
 *
 * Produces a categorical LOW | MEDIUM | HIGH output from explicit
 * demonstration rules with exact rule reasons. It does NOT generate a
 * probability — the plan forbids calibrated risk probabilities.
 */
import type { RiskLevel } from "@mfa/contracts";
import { DEMO_POLICY, type DecisionPolicy } from "./policy.js";

export interface RiskInput {
  amountMinor: number;
  payeeIsKnown: boolean;
  firstSeen: boolean;
  failedLoginCount: number;
  sessionAgeSeconds: number;
  recentSimChange: boolean | null;
  geoDistanceFromLastLoginKm: number | null;
  phishingRelayIndicator: boolean;
}

export interface RiskEvaluation {
  level: RiskLevel;
  reasons: string[];
}

interface Rule {
  code: string;
  present: boolean;
}

export function evaluateRisk(
  input: RiskInput,
  policy: DecisionPolicy = DEMO_POLICY
): RiskEvaluation {
  const majorRules: Rule[] = [
    {
      code: "high_value_amount",
      present: input.amountMinor >= policy.highValueAmountMinor,
    },
    { code: "recent_sim_change", present: input.recentSimChange === true },
    { code: "first_seen_device", present: input.firstSeen },
    {
      code: "large_geo_distance",
      present:
        input.geoDistanceFromLastLoginKm !== null &&
        input.geoDistanceFromLastLoginKm >= policy.largeGeoDistanceKm,
    },
    {
      code: "repeated_failed_logins",
      present: input.failedLoginCount >= policy.failedLoginThreshold,
    },
    { code: "phishing_relay_indicator", present: input.phishingRelayIndicator },
  ];

  const minorRules: Rule[] = [
    { code: "new_payee", present: !input.payeeIsKnown },
    {
      code: "unusual_session",
      present: input.sessionAgeSeconds <= policy.unusualSessionAgeSeconds,
    },
  ];

  const majorPresent = majorRules.filter((r) => r.present).map((r) => r.code);
  const minorPresent = minorRules.filter((r) => r.present).map((r) => r.code);
  const otherMinorPresent = minorPresent.filter((code) => code !== "new_payee");

  // A new payee alone is not high risk; a new payee combined with any other
  // observed indicator escalates the decision.
  const newPayeeWithContext =
    !input.payeeIsKnown && (majorPresent.length > 0 || otherMinorPresent.length > 0);

  let level: RiskLevel;
  if (majorPresent.length > 0 || newPayeeWithContext) {
    level = "HIGH";
  } else if (minorPresent.length > 0) {
    level = "MEDIUM";
  } else {
    level = "LOW";
  }

  return { level, reasons: [...majorPresent, ...minorPresent] };
}
