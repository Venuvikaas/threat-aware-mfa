import type { Scenario } from "../engine/types";

/**
 * Scenario A — Suspected SIM swap.
 *
 * Seeded demo input only. The indicators are synthetic and represent what an
 * upstream device/transaction signal system would supply; the product does
 * not detect these events itself.
 */
export const simSwapScenario: Scenario = {
  id: "sim-swap",
  title: "Suspected SIM swap",
  aggregateRisk: "high",
  requiredAssurance: 2,
  transaction: {
    amount: 12500,
    currency: "INR",
    payeeType: "new",
  },
  indicators: {
    recentSimChange: true,
    phishingRelayIndicator: false,
    newDevice: true,
    unusualSession: false,
    newPayee: true,
  },
  capabilities: {
    passkeyEnrolled: true,
  },
};
