/**
 * Threat engine (docs/EXECUTION.md Phase 2).
 *
 * Supports only narrow, defensible hypotheses:
 * - SIM_CHANNEL_COMPROMISE (primary evidence: recent SIM change)
 * - PHISHING (primary evidence: phishing-relay indicator)
 * - INSUFFICIENT_EVIDENCE (neither, conflict, or unavailable primary signal)
 *
 * Support is a band (HIGH | MODERATE | INSUFFICIENT), never a probability.
 */
import type { ThreatSupport, ThreatType } from "@mfa/contracts";
import { DEMO_POLICY, type DecisionPolicy } from "./policy.js";

export interface ThreatInput {
  recentSimChange: boolean | null;
  phishingRelayIndicator: boolean;
  firstSeen: boolean;
  payeeIsKnown: boolean;
  amountMinor: number;
  failedLoginCount: number;
  sessionAgeSeconds: number;
}

export interface ThreatEvaluation {
  type: ThreatType;
  support: ThreatSupport;
  evidence: string[];
}

export function evaluateThreat(
  input: ThreatInput,
  policy: DecisionPolicy = DEMO_POLICY
): ThreatEvaluation {
  const simPrimary = input.recentSimChange === true;
  const phishingPrimary = input.phishingRelayIndicator === true;

  // Conflicting primary indicators: no safe hypothesis (MVP rule).
  if (simPrimary && phishingPrimary) {
    return {
      type: "INSUFFICIENT_EVIDENCE",
      support: "INSUFFICIENT",
      evidence: ["conflicting_primary_indicators"],
    };
  }

  if (simPrimary) {
    const supporting = simSupportingContext(input, policy);
    return {
      type: "SIM_CHANNEL_COMPROMISE",
      support: supporting.length > 0 ? "HIGH" : "MODERATE",
      evidence: ["recent_sim_change", ...supporting],
    };
  }

  if (phishingPrimary) {
    const supporting = phishingSupportingContext(input, policy);
    return {
      type: "PHISHING",
      support: supporting.length >= 2 ? "HIGH" : "MODERATE",
      evidence: ["phishing_relay_indicator", ...supporting],
    };
  }

  const simUnknown = input.recentSimChange === null;
  return {
    type: "INSUFFICIENT_EVIDENCE",
    support: "INSUFFICIENT",
    evidence: [simUnknown ? "primary_signal_unavailable" : "no_supported_primary_indicator"],
  };
}

function simSupportingContext(
  input: ThreatInput,
  policy: DecisionPolicy
): string[] {
  const context: string[] = [];
  if (input.firstSeen) context.push("first_seen_device");
  if (!input.payeeIsKnown) context.push("new_payee");
  if (input.amountMinor >= policy.highValueAmountMinor) {
    context.push("high_value_transfer");
  }
  return context;
}

function phishingSupportingContext(
  input: ThreatInput,
  policy: DecisionPolicy
): string[] {
  const context: string[] = [];
  if (input.firstSeen) context.push("first_seen_device");
  if (!input.payeeIsKnown) context.push("new_payee");
  if (input.failedLoginCount >= 1) context.push("recent_failed_logins");
  if (input.sessionAgeSeconds <= policy.unusualSessionAgeSeconds) {
    context.push("unusual_session");
  }
  return context;
}
