/**
 * Frozen domain contracts.
 *
 * The decision engine and the UI communicate exclusively through these types.
 * Contract rules (see docs/EXECUTION.md, Part 1):
 * - No nullable or optional fields unless explicitly required.
 * - No decimal threat probabilities.
 * - No time, random, browser, storage, or network values in the decision function.
 * - Every factor receives exactly one state.
 * - Every non-eligible factor receives one stable reason code and one reason.
 * - Unsupported evidence returns `insufficient_evidence`.
 */

export type RiskLevel = "high";

export type ThreatHypothesis =
  | "sim_channel_compromise"
  | "phishing"
  | "insufficient_evidence";

export type SupportBand =
  | "high_support"
  | "moderate_support"
  | "insufficient_evidence";

export type FactorId = "sms_otp" | "passkey";

export type FactorState = "eligible" | "excluded" | "unavailable";

export type DecisionOutcome = "factor_selected" | "assisted_recovery";

export interface Scenario {
  id: string;
  title: string;
  aggregateRisk: RiskLevel;
  requiredAssurance: number;
  transaction: {
    amount: number;
    currency: "INR";
    payeeType: "new" | "known";
  };
  indicators: {
    recentSimChange: boolean;
    phishingRelayIndicator: boolean;
    newDevice: boolean;
    unusualSession: boolean;
    newPayee: boolean;
  };
  capabilities: {
    passkeyEnrolled: boolean;
  };
}

export interface FactorEvaluation {
  factorId: FactorId;
  state: FactorState;
  reasonCode: string;
  reason: string;
  assurance: number;
}

export interface Decision {
  scenarioId: string;
  policyVersion: string;
  hypothesis: ThreatHypothesis;
  supportBand: SupportBand;
  evidenceUsed: string[];
  doNotTrust: string[];
  factors: FactorEvaluation[];
  selectedFactor: FactorId | null;
  outcome: DecisionOutcome;
  outcomeMessage: string;
}

/** A stable reason code plus copy-safe human-readable explanation. */
export interface FactorReason {
  reasonCode: string;
  reason: string;
}

/** Copy and metadata for one supported hypothesis class. */
export interface ThreatRule {
  supportBand: SupportBand;
  doNotTrust: string[];
  reasonCode: string;
  reason: string;
}

/**
 * One factor's policy definition. All copy is committed fixture text;
 * the engine never invents prose.
 */
export interface FactorPolicy {
  factorId: FactorId;
  displayName: string;
  assurance: number;
  incompatibleWith: ThreatHypothesis[];
  /** Per-hypothesis exclusion reason; only present for incompatible hypotheses. */
  excludedReasonByHypothesis: Partial<Record<ThreatHypothesis, FactorReason>>;
  /** Capability gate; `passkey_enrolled` is the only gate in the demo policy. */
  availabilityRequirement: "passkey_enrolled" | "none";
  unavailableReason: FactorReason;
  /** Reason shown when assurance is below the scenario threshold. */
  assuranceBelowReason: FactorReason;
  eligibleReason: FactorReason;
  /** Copy shown when this factor is the selected outcome. */
  selectionMessage: string;
}

/**
 * Static policy fixture contract. Contains evidence-to-hypothesis rules,
 * threat compatibility, factor availability requirements, and the fixed
 * preference order. Implementation lives in src/policy/.
 */
export interface Policy {
  version: string;
  threats: {
    simChannelCompromise: ThreatRule;
    phishing: ThreatRule;
    insufficientEvidence: ThreatRule;
  };
  factors: FactorPolicy[];
  /** Lowest-friction-first among eligible factors. */
  preferenceOrder: FactorId[];
  assistedRecoveryMessage: string;
}
