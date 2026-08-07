/**
 * Challenge service (docs/EXECUTION.md Phase 6).
 *
 * - Challenge creation is refused for blocked or unavailable factors
 *   (POLICY_REJECTION) — the direct-API enforcement proof point.
 * - Verification rejects missing, expired, consumed challenges and marks the
 *   challenge consumed + updates the transaction state in one transaction.
 */
import type {
  CreateChallengeResponse,
  FactorId,
  VerifyChallengeResponse,
} from "@mfa/contracts";
import type { Db } from "../db/connection.js";
import { FACTOR_ADAPTERS } from "../factors/simulatedPasskeyAdapter.js";
import { newId } from "../lib/ids.js";
import {
  challengeError,
  notFoundError,
  policyError,
} from "../middleware/errorHandler.js";
import { AuditRepository } from "../repositories/auditRepository.js";
import { ChallengeRepository } from "../repositories/challengeRepository.js";
import { DecisionRepository } from "../repositories/decisionRepository.js";
import { TransactionRepository } from "../repositories/transactionRepository.js";

const CHALLENGE_TTL_MS = 5 * 60 * 1000;

export class ChallengeService {
  private readonly decisions: DecisionRepository;
  private readonly transactions: TransactionRepository;
  private readonly challenges: ChallengeRepository;
  private readonly audit: AuditRepository;

  constructor(private readonly db: Db) {
    this.decisions = new DecisionRepository(db);
    this.transactions = new TransactionRepository(db);
    this.challenges = new ChallengeRepository(db);
    this.audit = new AuditRepository(db);
  }

  createChallenge(decisionId: string, factor: FactorId): CreateChallengeResponse {
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

    const adapter = FACTOR_ADAPTERS[factor];
    const now = new Date();
    const createdAt = now.toISOString();
    const expiresAt = new Date(now.getTime() + CHALLENGE_TTL_MS).toISOString();

    if (!adapter) {
      throw policyError(`No adapter is registered for factor ${factor}`);
    }

    const created = adapter.createChallenge();
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

  verifyChallenge(challengeId: string, response: unknown): VerifyChallengeResponse {
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

    const adapter = FACTOR_ADAPTERS[challenge.factor];
    if (!adapter) {
      throw challengeError(`No adapter is registered for factor ${challenge.factor}`);
    }

    const { verified } = adapter.verifyChallenge(response, challenge.challengeData);
    const transactionStatus = verified ? "AUTHORIZED" : "DENIED";
    const verifiedAt = now.toISOString();

    const apply = this.db.transaction(() => {
      const consumed = this.challenges.consume(challengeId, verified, verifiedAt);
      if (!consumed) {
        throw challengeError(`Challenge ${challengeId} has already been consumed`);
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
