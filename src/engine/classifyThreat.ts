import type { Policy, Scenario, SupportBand, ThreatHypothesis } from "./types";
import { EVIDENCE_LABELS } from "../policy/reasonCodes";

/** The subset of a decision produced by the classifier. */
export interface ThreatClassification {
  hypothesis: ThreatHypothesis;
  supportBand: SupportBand;
  evidenceUsed: string[];
  doNotTrust: string[];
}

/**
 * Deterministic evidence -> hypothesis classification.
 *
 * Precedence (no conflict resolution is invented for the MVP):
 * 1. Both primary indicators present -> `insufficient_evidence` (conflict).
 * 2. Recent SIM change (with supporting context) -> `sim_channel_compromise`.
 * 3. Phishing-relay indicator -> `phishing`.
 * 4. No supported primary indicator -> `insufficient_evidence`.
 *
 * Support bands are derived without probabilities: a primary indicator with
 * supporting context earns the policy's explicit band; a lone primary
 * indicator earns `moderate_support`; nothing supported earns
 * `insufficient_evidence`.
 */
export function classifyThreat(
  scenario: Scenario,
  policy: Policy
): ThreatClassification {
  const indicators = scenario.indicators;

  const conflicting =
    indicators.recentSimChange && indicators.phishingRelayIndicator;
  const hasSimChange = indicators.recentSimChange && !conflicting;
  const hasPhishingRelay = indicators.phishingRelayIndicator && !conflicting;

  if (conflicting) {
    return insufficientClassification(policy, scenario);
  }

  if (hasSimChange) {
    const supporting =
      indicators.newDevice || indicators.unusualSession || indicators.newPayee;
    return {
      hypothesis: "sim_channel_compromise",
      supportBand: supporting
        ? policy.threats.simChannelCompromise.supportBand
        : "moderate_support",
      evidenceUsed: observedEvidenceLabels(scenario),
      doNotTrust: [...policy.threats.simChannelCompromise.doNotTrust],
    };
  }

  if (hasPhishingRelay) {
    const supporting =
      indicators.newDevice || indicators.unusualSession || indicators.newPayee;
    return {
      hypothesis: "phishing",
      supportBand: supporting
        ? policy.threats.phishing.supportBand
        : "moderate_support",
      evidenceUsed: observedEvidenceLabels(scenario),
      doNotTrust: [...policy.threats.phishing.doNotTrust],
    };
  }

  return insufficientClassification(policy, scenario);
}

function insufficientClassification(
  policy: Policy,
  scenario: Scenario
): ThreatClassification {
  return {
    hypothesis: "insufficient_evidence",
    supportBand: policy.threats.insufficientEvidence.supportBand,
    evidenceUsed: observedEvidenceLabels(scenario),
    doNotTrust: [...policy.threats.insufficientEvidence.doNotTrust],
  };
}

function observedEvidenceLabels(scenario: Scenario): string[] {
  const labels: string[] = [];
  const indicators = scenario.indicators;
  const entries: Array<[keyof typeof EVIDENCE_LABELS, boolean]> = [
    ["recentSimChange", indicators.recentSimChange],
    ["phishingRelayIndicator", indicators.phishingRelayIndicator],
    ["newDevice", indicators.newDevice],
    ["unusualSession", indicators.unusualSession],
    ["newPayee", indicators.newPayee],
  ];
  for (const [key, present] of entries) {
    if (present) labels.push(EVIDENCE_LABELS[key]);
  }
  return labels;
}
