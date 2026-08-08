/**
 * Scenario presets (EXECUTION_new2.md §5.6, Phase 5).
 *
 * The three judge presets mirror @mfa/demo-data (the backend owns the exact
 * request shapes); the frontend just produces a fresh client transaction id
 * per submission so idempotency never blocks a repeat demo.
 */
import {
  CONSTRAINED_SCENARIO_ID,
  constrainedCapabilityScenario,
  PHISHING_SCENARIO_ID,
  phishingScenario,
  SIM_SWAP_SCENARIO_ID,
  simSwapScenario,
} from "@mfa/demo-data";
import type { CreateDecisionRequest } from "@mfa/contracts";

export interface ScenarioMeta {
  id: string;
  label: string;
  tagline: string;
  build: () => CreateDecisionRequest;
}

export const DEMO_PRESETS: ScenarioMeta[] = [
  {
    id: SIM_SWAP_SCENARIO_ID,
    label: "SIM swap",
    tagline: "Recent SIM change + new device",
    build: () => simSwapScenario.build(`web_${Date.now()}_${Math.floor(Math.random() * 1e6)}`),
  },
  {
    id: PHISHING_SCENARIO_ID,
    label: "Phishing relay",
    tagline: "Relay indicator — same ₹50k risk",
    build: () => phishingScenario.build(`web_${Date.now()}_${Math.floor(Math.random() * 1e6)}`),
  },
  {
    id: CONSTRAINED_SCENARIO_ID,
    label: "No passkey",
    tagline: "SIM change, passkey not enrolled",
    build: () => constrainedCapabilityScenario.build(`web_${Date.now()}_${Math.floor(Math.random() * 1e6)}`),
  },
];
