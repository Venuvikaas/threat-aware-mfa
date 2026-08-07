/**
 * Simulated passkey adapter (docs/EXECUTION.md Phase 6).
 *
 * Explicitly labeled SIMULATED. The client must submit `{ simulatedOk: true }`
 * to authorize — anything else is treated as a denied verification. This is
 * the required fallback that demonstrates the adapter boundary without a real
 * WebAuthn ceremony.
 */
import type { FactorId } from "@mfa/contracts";
import type { CreateChallengeResult, FactorAdapter } from "./factorAdapter.js";
import { randomUUID } from "node:crypto";

export class SimulatedPasskeyAdapter implements FactorAdapter {
  readonly factor: FactorId = "PASSKEY";

  createChallenge(): CreateChallengeResult {
    return {
      mode: "SIMULATED",
      challengeData: { nonce: randomUUID(), simulated: true },
    };
  }

  verifyChallenge(
    response: unknown,
    _challengeData: unknown
  ): { verified: boolean } {
    const body = response as { simulatedOk?: unknown } | null;
    return { verified: body?.simulatedOk === true };
  }
}

/** Adapters registered per factor; only the simulated passkey ships in the demo. */
export const FACTOR_ADAPTERS: Partial<Record<FactorId, FactorAdapter>> = {
  PASSKEY: new SimulatedPasskeyAdapter(),
};
