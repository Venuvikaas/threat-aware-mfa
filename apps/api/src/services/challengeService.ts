/**
 * Challenge service (docs/EXECUTION_new.md Phase 6/7).
 *
 * - Challenge creation is refused for blocked or unavailable factors
 *   (POLICY_REJECTION) — the direct-API enforcement proof point.
 * - The PASSKEY adapter runs a real WebAuthn ceremony when a credential is
 *   registered and the origin is WebAuthn-capable; otherwise it automatically
 *   falls back to the labeled SIMULATED adapter. A demo-only `preferSimulated`
 *   hint lets the UI explicitly request the labeled simulated path.
 * - Verification rejects missing, expired, consumed challenges; a WEBAUTHN
 *   challenge must also be verified from the origin it was issued for; and
 *   consumption, transaction-state update, signature-counter persistence, and
 *   audit all commit in one database transaction.
 */
import type {
  CreateChallengeResponse,
  FactorId,
  VerifyChallengeResponse,
} from "@mfa/contracts";
import type { Db } from "../db/connection.js";
import type { FactorAdapter } from "../factors/factorAdapter.js";
import { SimulatedPasskeyAdapter } from "../factors/simulatedPasskeyAdapter.js";
import { buildFactorAdapters } from "../factors/webauthnPasskeyAdapter.js";
import { newId } from "../lib/ids.js";
import {
  challengeError,
  notFoundError,
  policyError,
  validationError,
} from "../middleware/errorHandler.js";
import { AuditRepository } from "../repositories/auditRepository.js";
import { ChallengeRepository } from "../repositories/challengeRepository.js";
import { DecisionRepository } from "../repositories/decisionRepository.js";
import { PasskeyCredentialRepository } from "../repositories/passkeyRepository.js";
import { TransactionRepository } from "../repositories/transactionRepository.js";
import { resolveOrigin, type AuthChallengeData } from "./webauthnService.js";

const CHALLENGE_TTL_MS = 5 * 60 * 1000;

export interface CreateChallengeContext {
  /** Origin header of the requesting client (defaults inside the adapter). */
  origin?: string;
  /**
   * Demo-only hint: create the labeled SIMULATED challenge even when a real
   * WebAuthn ceremony would be possible. Rejected outside demo mode.
   */
  preferSimulated?: boolean;
}

export class ChallengeService {
  private readonly decisions: DecisionRepository;
  private readonly transactions: TransactionRepository;
  private readonly challenges: ChallengeRepository;
  private readonly audit: AuditRepository;
  private readonly passkeys: PasskeyCredentialRepository;
  private readonly adapters: Partial<Record<FactorId, FactorAdapter>>;
  private readonly simulated = new SimulatedPasskeyAdapter();

  constructor(
    private readonly db: Db,
    private readonly demoMode: boolean = true
  ) {
    this.decisions = new DecisionRepository(db);
    this.transactions = new TransactionRepository(db);
    this.challenges = new ChallengeRepository(db);
    this.audit = new AuditRepository(db);
    this.passkeys = new PasskeyCredentialRepository(db);
    this.adapters = buildFactorAdapters(db);
  }

  async createChallenge(
    decisionId: string,
    factor: FactorId,
    ctx: CreateChallengeContext = {}
  ): Promise<CreateChallengeResponse> {
    const decision = this.decisions.findById(decisionId);
    if (!decision) {
      throw notFoundError(`Decision ${decisionId} not found`);
    }

    const allowed = decision.allowedFactors.includes(factor);
    if (!allowed) {
      const evaluation = decision.factorEvaluations.find((f) => f.factor === factor);
      throw policyError(
        `Factor ${factor} is not allowed for this decision`,
        {
          factor,
          status: evaluation?.status ?? "UNKNOWN",
          reasonCode: evaluation?.reasonCode ?? "not_in_allowed_list",
        }
      );
    }

    if (ctx.preferSimulated && !this.demoMode) {
      throw validationError({
        preferSimulated: "the simulated fallback is a demo-mode-only affordance",
      });
    }

    const transaction = this.transactions.findById(decision.transactionId);
    const userId = transaction?.userId ?? "";

    let adapter: FactorAdapter | undefined;
    if (ctx.preferSimulated && factor === "PASSKEY") {
      adapter = this.simulated;
    } else {
      adapter = this.adapters[factor];
    }

    const now = new Date();
    const createdAt = now.toISOString();
    const expiresAt = new Date(now.getTime() + CHALLENGE_TTL_MS).toISOString();

    if (!adapter) {
      throw policyError(`No adapter is registered for factor ${factor}`);
    }

    const created = await adapter.createChallenge({
      decisionId,
      userId,
      origin: ctx.origin ?? "",
    });
    const challengeId = newId("ch");

    this.challenges.create({
      id: challengeId,
      decisionId,
      factor,
      mode: created.mode,
      challengeData: created.challengeData,
      expiresAt,
      consumedAt: null,
      verified: false,
      createdAt,
    });
    this.audit.insert({
      decisionId,
      eventType: "CHALLENGE_CREATED",
      reasonCode: "challenge_created",
      details: { factor, mode: created.mode, challengeId },
      createdAt,
    });

    return {
      challengeId,
      factor,
      mode: created.mode,
      expiresAt,
      publicOptions: created.publicOptions,
    };
  }

  async verifyChallenge(
    challengeId: string,
    response: unknown,
    ctx: { origin?: string } = {}
  ): Promise<VerifyChallengeResponse> {
    const challenge = this.challenges.findById(challengeId);
    if (!challenge) {
      throw challengeError(`Challenge ${challengeId} does not exist`);
    }

    const now = new Date();
    if (challenge.expiresAt <= now.toISOString()) {
      throw challengeError(`Challenge ${challengeId} has expired`);
    }
    if (challenge.consumedAt !== null) {
      throw challengeError(`Challenge ${challengeId} has already been consumed`);
    }

    // Phase 7 origin binding: a WEBAUTHN challenge must be verified from the
    // origin it was issued for (defense-in-depth on top of the stored
    // expected-origin check inside the ceremony verification).
    if (challenge.mode === "WEBAUTHN") {
      const data = challenge.challengeData as Partial<AuthChallengeData> | null;
      if (data?.expectedOrigin && resolveOrigin(ctx.origin) !== data.expectedOrigin) {
        throw challengeError(`Challenge ${challengeId} was issued for a different origin`);
      }
    }

    const adapter = this.adapters[challenge.factor];
    if (!adapter) {
      throw challengeError(`No adapter is registered for factor ${challenge.factor}`);
    }

    const result = await adapter.verifyChallenge(response, challenge.challengeData);
    const { verified } = result;
    const transactionStatus = verified ? "AUTHORIZED" : "DENIED";
    const verifiedAt = now.toISOString();

    const apply = this.db.transaction(() => {
      const consumed = this.challenges.consume(challengeId, verified, verifiedAt);
      if (!consumed) {
        throw challengeError(`Challenge ${challengeId} has already been consumed`);
      }
      // Advance the WebAuthn signature counter in the same transaction that
      // consumes the challenge (replay protection is one atomic state change).
      if (verified && result.credentialId && typeof result.newCounter === "number") {
        this.passkeys.updateCounter(result.credentialId, result.newCounter);
      }
      const decision = this.decisions.findById(challenge.decisionId);
      if (decision) {
        this.transactions.updateStatus(
          decision.transactionId,
          transactionStatus
        );
        this.audit.insert({
          decisionId: challenge.decisionId,
          eventType: "CHALLENGE_VERIFIED",
          reasonCode: verified ? "challenge_verified" : "challenge_failed",
          details: { challengeId, factor: challenge.factor, verified, transactionStatus },
          createdAt: verifiedAt,
        });
      }
    });
    apply();

    return { challengeId, verified, transactionStatus };
  }
}
