/**
 * Simulated passkey adapter (docs/EXECUTION_new.md Phase 6).
 *
 * Explicitly labeled SIMULATED. The client must submit `{ simulatedOk: true }`
 * to authorize — anything else is treated as a denied verification. This is
 * the required fallback that demonstrates the adapter boundary without a real
 * WebAuthn ceremony. In Phase 7 the WebAuthn adapter falls back to this
 * adapter automatically (and visibly, through the challenge `mode`) whenever
 * a real ceremony is not possible.
 */
import type { FactorId } from "@mfa/contracts";
import { randomUUID } from "node:crypto";
import type {
  ChallengeContext,
  CreateChallengeResult,
  FactorAdapter,
  VerifyChallengeResult,
} from "./factorAdapter.js";

export class SimulatedPasskeyAdapter implements FactorAdapter {
  readonly factor: FactorId = "PASSKEY";

  async createChallenge(_context: ChallengeContext): Promise<CreateChallengeResult> {
    return {
      mode: "SIMULATED",
      challengeData: { nonce: randomUUID(), simulated: true },
    };
  }

  async verifyChallenge(
    response: unknown,
    _challengeData: unknown
  ): Promise<VerifyChallengeResult> {
    const body = response as { simulatedOk?: unknown } | null;
    return { verified: body?.simulatedOk === true };
  }
}
