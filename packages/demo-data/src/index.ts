/**
 * Deterministic synthetic demo scenarios (EXECUTION_new2.md §5.6, §11).
 *
 * Three judge presets: two equal-risk hero scenarios (SIM swap, phishing
 * relay) that weaken different trust dependencies, and one capability-
 * constrained scenario that forces assisted recovery.
 */
export * from "./users.js";
export * from "./simSwap.js";
export * from "./phishing.js";
export * from "./constrainedCapability.js";

import { CONSTRAINED_SCENARIO_ID, constrainedCapabilityScenario } from "./constrainedCapability.js";
import { PHISHING_SCENARIO_ID, phishingScenario } from "./phishing.js";
import { SIM_SWAP_SCENARIO_ID, simSwapScenario } from "./simSwap.js";
import type { CreateDecisionRequest } from "@mfa/contracts";

export interface DemoScenarioPreset {
  id: string;
  label: string;
  description: string;
  build: (clientTransactionId: string) => CreateDecisionRequest;
}

export const DEMO_SCENARIOS: DemoScenarioPreset[] = [
  {
    id: SIM_SWAP_SCENARIO_ID,
    label: "₹50,000 SIM-change transfer",
    description:
      "Recent SIM change + brand-new device. SIM ownership is distrusted, SMS OTP becomes ineligible, passkey is selected.",
    build: (ct) => simSwapScenario.build(ct),
  },
  {
    id: PHISHING_SCENARIO_ID,
    label: "₹50,000 phishing relay",
    description:
      "Same risk level as SIM swap, but a phishing relay. Telecom delivery is distrusted — SMS fails for a different reason.",
    build: (ct) => phishingScenario.build(ct),
  },
  {
    id: CONSTRAINED_SCENARIO_ID,
    label: "SIM change without a passkey",
    description:
      "Same SIM-change context for a user with no passkey and no TOTP seed. Passkey is unavailable, so assisted recovery is required.",
    build: (ct) => constrainedCapabilityScenario.build(ct),
  },
];

export function scenarioById(id: string): DemoScenarioPreset | undefined {
  return DEMO_SCENARIOS.find((s) => s.id === id);
}
