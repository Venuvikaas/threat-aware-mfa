/**
 * Factor adapter contract (docs/EXECUTION_new.md Phase 6/7).
 *
 * A factor adapter knows how to create a challenge and verify a response for
 * one factor. The demo ships the simulated passkey adapter (required fallback)
 * and the WebAuthn passkey adapter (Phase 7 stretch) behind the same
 * interface. Verification is async because a real WebAuthn ceremony performs
 * cryptographic verification.
 */
import type { ChallengeMode, FactorId } from "@mfa/contracts";

/** Context a challenge is created for, supplied by the challenge service. */
export interface ChallengeContext {
  decisionId: string;
  /** Owner of the decision — used to bind WebAuthn credentials. */
  userId: string;
  /** Request Origin header (fallback default), used for WebAuthn RP binding. */
  origin: string;
}

export interface CreateChallengeResult {
  /** Mode reported to clients; the simulated adapter always returns SIMULATED. */
  mode: ChallengeMode;
  /** Public options for the client ceremony (WebAuthn options), if any. */
  publicOptions?: unknown;
  /** Server-side secret material stored with the challenge, never returned. */
  challengeData: unknown;
}

export interface VerifyChallengeResult {
  verified: boolean;
  /**
   * Present only when the verified path advanced a WebAuthn signature
   * counter; the challenge service persists it atomically with consumption.
   */
  newCounter?: number;
  credentialId?: string;
}

export interface FactorAdapter {
  readonly factor: FactorId;
  createChallenge(context: ChallengeContext): Promise<CreateChallengeResult>;
  /** Verify a client response against the stored challenge data. */
  verifyChallenge(response: unknown, challengeData: unknown): Promise<VerifyChallengeResult>;
}
