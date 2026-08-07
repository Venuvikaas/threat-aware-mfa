/**
 * Factor adapter contract (docs/EXECUTION.md Phase 6).
 *
 * A factor adapter knows how to create a challenge and verify a response for
 * one factor. The demo ships the simulated passkey adapter; a real WebAuthn
 * adapter is the stretch phase and would implement the same interface.
 */
import type { ChallengeMode, FactorId } from "@mfa/contracts";

export interface CreateChallengeResult {
  /** Mode reported to clients; the simulated adapter always returns SIMULATED. */
  mode: ChallengeMode;
  /** Public options for the client ceremony (WebAuthn options), if any. */
  publicOptions?: unknown;
  /** Server-side secret material stored with the challenge, never returned. */
  challengeData: unknown;
}

export interface FactorAdapter {
  readonly factor: FactorId;
  createChallenge(): CreateChallengeResult;
  /** Verify a client response against the stored challenge data. */
  verifyChallenge(response: unknown, challengeData: unknown): { verified: boolean };
}
