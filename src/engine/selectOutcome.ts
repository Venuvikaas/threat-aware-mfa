import type {
  DecisionOutcome,
  FactorEvaluation,
  FactorId,
  Policy,
} from "./types";

export interface OutcomeSelection {
  selectedFactor: FactorId | null;
  outcome: DecisionOutcome;
  outcomeMessage: string;
}

/**
 * Select the first eligible factor in the policy's fixed preference order
 * (lowest friction that satisfies policy). When no factor survives, the
 * outcome is assisted recovery — never an unsafe fallback and never a
 * permanent lockout.
 */
export function selectOutcome(
  factors: FactorEvaluation[],
  policy: Policy
): OutcomeSelection {
  const eligible = factors.filter((factor) => factor.state === "eligible");

  if (eligible.length === 0) {
    return {
      selectedFactor: null,
      outcome: "assisted_recovery",
      outcomeMessage: policy.assistedRecoveryMessage,
    };
  }

  const ranked = [...eligible].sort(
    (a, b) =>
      preferenceRank(a.factorId, policy) - preferenceRank(b.factorId, policy)
  );
  const winner = ranked[0];

  return {
    selectedFactor: winner.factorId,
    outcome: "factor_selected",
    outcomeMessage: factorSelectionMessage(winner.factorId, policy),
  };
}

function preferenceRank(factorId: FactorId, policy: Policy): number {
  const index = policy.preferenceOrder.indexOf(factorId);
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

function factorSelectionMessage(factorId: FactorId, policy: Policy): string {
  const factor = policy.factors.find((entry) => entry.factorId === factorId);
  return factor ? factor.selectionMessage : policy.assistedRecoveryMessage;
}
