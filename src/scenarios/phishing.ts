import type { Scenario } from "../engine/types";

/**
 * Scenario B — Suspected phishing relay.
 *
 * Deliberately mirrors Scenario A on every scalar dimension (aggregate risk,
 * required assurance, transaction amount, payee sensitivity) so the only
 * difference between the panels is the threat composition and its effect on
 * factor eligibility.
 */
export const phishingScenario: Scenario = {
  id: "phishing",
  title: "Suspected phishing relay",
  aggregateRisk: "high",
  requiredAssurance: 2,
  transaction: {
    amount: 12500,
    currency: "INR",
    payeeType: "new",
  },
  indicators: {
    recentSimChange: false,
    phishingRelayIndicator: true,
    newDevice: false,
    unusualSession: true,
    newPayee: true,
  },
  capabilities: {
    passkeyEnrolled: true,
  },
};
