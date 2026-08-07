/**
 * Challenge service (EXECUTION_new2.md §5.3, Phase 4).
 *
 * - Challenge creation is refused unless the persisted decision marks the
 *   factor ELIGIBLE and policy permits it (POLICY_REJECTION) — the direct-API
 *   enforcement proof point. Ineligible, unavailable, disabled, and
 *   non-selected factors can never create a challenge.
 * - PASSKEY runs the labeled simulated adapter by default (the required safe
 *   execution path); the WebAuthn stretch adapter is used when available.
 * - Verification rejects missing, expired, and consumed challenges; an
 *   outcome trace event (CHALLENGE/OUTCOME) is appended atomically with
 *   consumption.
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
import { ChallengeRepository } from "../repositories/challengeRepository.js";
import { DecisionRepository } from "../repositories/decisionRepository.js";
import { TransactionRepository } from "../repositories/transactionRepository.js";

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
  private readonly adapters: Partial<Record<FactorId, FactorAdapter>>;
  private readonly simulated = new SimulatedPasskeyAdapter();

  constructor(
    private readonly db: Db,
    private readonly demoMode: boolean = true
  ) {
    this.decisions = new DecisionRepository(db);
    this.transactions = new TransactionRepository(db);
    this.challenges = new ChallengeRepository(db);
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

    // Enforce the persisted factor decision — never recompute eligibility.
    const evaluation = decision.factors.find((f) => f.factorId === factor);
    const eligible = evaluation?.status === "ELIGIBLE";
    if (!eligible) {
      throw policyError(
        `Factor ${factor} is not eligible for this decision`,
        {
          factor,
          status: evaluation?.status ?? "NOT_EVALUATED",
          failedRequirements: evaluation?.failedRequirements ?? [],
          reasonCodes: evaluation?.failedRequirements.map((r) => r.reasonCode) ?? [],
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
    if (!adapter) {
      throw policyError(`No adapter is registered for factor ${factor}`);
    }

    const now = new Date();
    const createdAt = now.toISOString();
    const expiresAt = new Date(now.getTime() + CHALLENGE_TTL_MS).toISOString();

    const created = await adapter.createChallenge({
      decisionId,
      userId,
      origin: ctx.origin ?? "",
    });
    const challengeId = newId("ch");

    const apply = this.db.transaction(() => {
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
      this.appendChallengeTrace(decisionId, "CHALLENGE", `challenge_created_${factor.toLowerCase()}`, {
        challengeId,
        factor,
        mode: created.mode,
      });
    });
    apply();

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

    // Phase 7 origin binding (stretch): a WEBAUTHN challenge must be verified
    // from the origin it was issued for.
    if (challenge.mode === "WEBAUTHN") {
      const data = challenge.challengeData as
        | { expectedOrigin?: string }
        | null;
      if (data?.expectedOrigin && resolveOrigin(ctx.origin) !== data.expectedOrigin) {
        throw challengeError(`Challenge ${challengeId} was issued for a different origin`);
      }
    }

    const adapter = this.adapters[challenge.factor] ?? this.simulated;
    const result = await adapter.verifyChallenge(response, challenge.challengeData);
    const verified = result.verified;
    const transactionStatus: VerifyChallengeResponse["transactionStatus"] = verified
      ? "AUTHORIZED"
      : "DENIED";
    const verifiedAt = now.toISOString();

    const apply = this.db.transaction(() => {
      const consumed = this.challenges.consume(challengeId, verified, verifiedAt);
      if (!consumed) {
        throw challengeError(`Challenge ${challengeId} has already been consumed`);
      }
      const decision = this.decisions.findById(challenge.decisionId);
      if (decision) {
        this.transactions.updateStatus(decision.transactionId, transactionStatus);
        this.appendChallengeTrace(
          challenge.decisionId,
          "OUTCOME",
          verified ? "challenge_verified" : "challenge_denied",
          { challengeId, factor: challenge.factor, verified, transactionStatus }
        );
      }
    });
    apply();

    return { challengeId, verified, transactionStatus };
  }

  /** Append a CHALLENGE/OUTCOME phase event to the decision's trace. */
  private appendChallengeTrace(
    decisionId: string,
    phase: "CHALLENGE" | "OUTCOME",
    explanationCode: string,
    _details: Record<string, unknown>
  ): void {
    const current = this.decisions.findById(decisionId);
    if (!current) return;
    const nextSequence =
      current.trace.reduce((max, e) => Math.max(max, e.sequence), -1) + 1;
    const event = {
      id: `tr_ch_${newId("").slice(4)}`,
      phase,
      ruleId: explanationCode,
      ruleVersion: current.policy.version,
      inputRefs: [decisionId],
      outputRefs: [],
      explanationCode,
      sequence: nextSequence,
    };
    // Persist directly; DecisionRepository re-reads the full graph on demand.
    this.db
      .prepare(
        `INSERT INTO trace_events (decision_id, event_id, phase, rule_id, rule_version,
           input_refs_json, output_refs_json, explanation_code, sequence)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        decisionId,
        event.id,
        event.phase,
        event.ruleId,
        event.ruleVersion,
        JSON.stringify(event.inputRefs),
        JSON.stringify(event.outputRefs),
        event.explanationCode,
        event.sequence
      );
  }
}

/** Normalize an Origin header to its scheme+host:port form. */
function resolveOrigin(rawOrigin: string | undefined): string {
  const origin = rawOrigin?.trim() ?? "";
  if (!origin) return "";
  try {
    const url = new URL(origin);
    return url.origin;
  } catch {
    return origin;
  }
}
