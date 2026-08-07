/**
 * Single pure evaluation entry point (EXECUTION_new2.md Phase 1 exit gate).
 *
 *   evaluateDecision(evidence, capabilities, policy)
 *     -> risk, threats, trust, factors, selection, action, trace
 *
 * One pure function accepts evidence, capabilities, and the policy bundle,
 * and returns the complete reasoning chain. No I/O, no time, no randomness —
 * every output is deterministic (the caller supplies `now` when normalizing
 * evidence).
 */
import type {
  CapabilityState,
  DecisionAction,
  EvidenceItem,
  FactorId,
  PolicyBundle,
  RiskResult,
} from "@mfa/contracts";
import { assessRisk } from "./assessRisk.js";
import { assessThreats } from "./assessThreats.js";
import { assessTrust } from "./assessTrust.js";
import { buildTrace } from "./buildTrace.js";
import { evaluateFactors } from "./evaluateFactors.js";
import { selectFactor } from "./selectFactor.js";

export interface DecisionEngineInput {
  /** Normalized evidence with provenance. */
  evidence: EvidenceItem[];
  /** User/device capability states. */
  capabilities: CapabilityState[];
  /** The immutable policy bundle (hash-verified by the caller). */
  policy: PolicyBundle;
}

export interface DecisionEngineOutput {
  risk: RiskResult;
  threats: ReturnType<typeof assessThreats>;
  trust: ReturnType<typeof assessTrust>;
  factors: ReturnType<typeof evaluateFactors>;
  selectedFactorId: FactorId | null;
  action: DecisionAction;
  trace: ReturnType<typeof buildTrace>["trace"];
}

export function evaluateDecision(input: DecisionEngineInput): DecisionEngineOutput {
  const { evidence, capabilities, policy } = input;

  const risk = assessRisk(evidence, policy);
  const threats = assessThreats(evidence, policy);
  const trust = assessTrust(threats, evidence, policy);

  const requiredAssurance = policy.selectionPolicy.requiredAssuranceByRisk[risk.level] ?? "AAL1";
  const factors = evaluateFactors(policy.factorDefinitions, {
    trust,
    capabilities,
    requiredAssurance,
    evidence,
  });

  const selectedFactorId = selectFactor(factors, policy.factorDefinitions, policy);
  const action: DecisionAction = selectedFactorId ? "CHALLENGE" : "ASSISTED_RECOVERY";

  const { trace, factorEventIds } = buildTrace({
    evidence,
    threats,
    trust,
    factors,
    selectedFactorId,
    policy,
  });

  // Attach the emitted eligibility trace events to each factor evaluation.
  for (const factor of factors) {
    factor.traceEventIds = factorEventIds[factor.factorId] ?? [];
  }

  return { risk, threats, trust, factors, selectedFactorId, action, trace };
}
