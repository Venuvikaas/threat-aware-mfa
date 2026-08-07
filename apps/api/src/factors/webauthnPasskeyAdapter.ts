/**
 * Real WebAuthn passkey adapter (docs/EXECUTION_new.md Phase 7).
 *
 * Implements the same factor-adapter contract as the simulated adapter, but
 * runs a real WebAuthn authentication ceremony through `WebAuthnService`.
 *
 * Automatic labeled fallback: when a real ceremony is not possible — the user
 * has no registered credential, or the request origin is not a WebAuthn
 * secure context — the adapter transparently returns the simulated adapter's
 * SIMULATED result. The challenge `mode` field carries that label to the
 * client, so the fallback is always visible and never ambiguous.
 */
import type { FactorId } from "@mfa/contracts";
import type { Db } from "../db/connection.js";
import {
  resolveOrigin,
  WebAuthnService,
  type AuthChallengeData,
} from "../services/webauthnService.js";
import type {
  ChallengeContext,
  CreateChallengeResult,
  FactorAdapter,
  VerifyChallengeResult,
} from "./factorAdapter.js";
import { SimulatedPasskeyAdapter } from "./simulatedPasskeyAdapter.js";

export class WebAuthnPasskeyAdapter implements FactorAdapter {
  readonly factor: FactorId = "PASSKEY";
  private readonly simulated = new SimulatedPasskeyAdapter();

  constructor(private readonly service: WebAuthnService) {}

  async createChallenge(context: ChallengeContext): Promise<CreateChallengeResult> {
    const origin = resolveOrigin(context.origin);
    const canRunRealCeremony =
      this.service.isSecureWebAuthnOrigin(origin) &&
      this.service.hasCredentials(context.userId);

    if (!canRunRealCeremony) {
      // Labeled automatic fallback: the client sees mode SIMULATED.
      return this.simulated.createChallenge(context);
    }

    const { options, challengeData } = await this.service.beginAuthentication(
      context.userId,
      origin
    );
    return { mode: "WEBAUTHN", publicOptions: options, challengeData };
  }

  async verifyChallenge(
    response: unknown,
    challengeData: unknown
  ): Promise<VerifyChallengeResult> {
    const data = challengeData as Partial<AuthChallengeData> | null;
    if (!data?.webauthn) {
      return this.simulated.verifyChallenge(response, challengeData);
    }
    return this.service.verifyAuthentication(response, data as AuthChallengeData);
  }
}

/**
 * Build the factor adapter registry for a database. The PASSKEY factor uses
 * the real WebAuthn adapter, which falls back to the simulated adapter when a
 * real ceremony is not possible.
 */
export function buildFactorAdapters(db: Db): Partial<Record<FactorId, FactorAdapter>> {
  return {
    PASSKEY: new WebAuthnPasskeyAdapter(new WebAuthnService(db)),
  };
}
