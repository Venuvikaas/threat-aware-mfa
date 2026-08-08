/**
 * Replay service (EXECUTION_new2.md §5.4, Phase 6).
 *
 * - EXACT replay re-runs the decision under the *original normalized
 *   evidence* and the original policy version — the determinism proof.
 *   The produced decision must be semantically identical (empty diff).
 * - FORK replay applies only the declared evidence/capability changes and
 *   never mutates the original decision: the produced decision is a full new
 *   decision row, replay_changes records the declared deltas, and the
 *   structured diff is computed and persisted.
 * - The whole write (transaction + produced decision + replay record +
 *   diff) happens atomically.
 */
import type {
  CreateReplayRequest,
  DecisionDiff,
  DecisionResponse,
  ReplayRecord,
} from "@mfa/contracts";
import { applyCapabilityOverrides, applyEvidenceOverrides, buildDecisionDiff, evaluateDecision } from "@mfa/decision-core";
import type { Db } from "../db/connection.js";
import { newId } from "../lib/ids.js";
import { notFoundError, replayError } from "../middleware/errorHandler.js";
import { CapabilityRepository } from "../repositories/capabilityRepository.js";
import { DecisionRepository } from "../repositories/decisionRepository.js";
import { PolicyRepository } from "../repositories/policyRepository.js";
import { ReplayRepository } from "../repositories/replayRepository.js";
import { TransactionRepository } from "../repositories/transactionRepository.js";

export class ReplayService {
  private readonly decisions: DecisionRepository;
  private readonly transactions: TransactionRepository;
  private readonly policies: PolicyRepository;
  private readonly capabilities: CapabilityRepository;
  private readonly replays: ReplayRepository;

  constructor(private readonly db: Db) {
    this.decisions = new DecisionRepository(db);
    this.transactions = new TransactionRepository(db);
    this.policies = new PolicyRepository(db);
    this.capabilities = new CapabilityRepository(db);
    this.replays = new ReplayRepository(db);
  }

  createReplay(decisionId: string, req: CreateReplayRequest): ReplayRecord {
    const source = this.decisions.findById(decisionId);
    if (!source) {
      throw notFoundError(`Decision ${decisionId} not found`);
    }

    const sourceTransaction = this.transactions.findById(source.transactionId);
    if (!sourceTransaction) {
      throw notFoundError(`Transaction for decision ${decisionId} not found`);
    }

    // Fork validation: declared changes are allowed in either mode, but the
    // mode shapes the semantics — EXACT ignores nothing but declares nothing.
    if (req.mode === "EXACT" && (req.evidenceChanges?.length || req.capabilityChanges?.length)) {
      throw replayError(
        "EXACT replay does not accept evidence or capability changes",
        { mode: req.mode }
      );
    }

    // Policy version: requested or the source decision's version (immutable).
    const policyVersion = req.policyVersion ?? source.policy.version;
    const policy = this.policies.findByVersion(policyVersion);
    if (!policy) {
      throw notFoundError(`Policy version ${policyVersion} not found`);
    }

    // Source bundle (Stretch B): the diff separates rule-level policy changes
    // from input/derived changes. Both bundles are immutable and hash-verified.
    const sourcePolicy = this.policies.findByVersion(source.policy.version);

    // Build the replay inputs from the source decision — never from fresh
    // providers, so the fork is a true counterfactual over the original.
    const now = new Date();
    const nowIso = now.toISOString();
    let evidence = source.evidence;
    let capabilities = this.capabilities.findByUserId(sourceTransaction.userId);

    if (req.mode === "FORK") {
      evidence = applyEvidenceOverrides(evidence, req.evidenceChanges ?? [], nowIso);
      capabilities = applyCapabilityOverrides(capabilities, req.capabilityChanges ?? []);
    }

    const evaluated = evaluateDecision({ evidence, capabilities, policy });

    const replayId = newId("rp");
    const producedDecisionId = newId("dec");
    const producedTransactionId = newId("txn");

    const apply = this.db.transaction(() => {
      // The produced decision needs its own transaction row (decisions are
      // 1:1 with transactions); derive a unique client id from the replay.
      this.transactions.create({
        id: producedTransactionId,
        clientTransactionId: `replay_${replayId}`,
        userId: sourceTransaction.userId,
        amountMinor: sourceTransaction.amountMinor,
        currency: sourceTransaction.currency,
        payeeId: sourceTransaction.payeeId,
        payeeIsKnown: sourceTransaction.payeeIsKnown,
        status: "PENDING",
        createdAt: nowIso,
      });

      this.decisions.persist({
        id: producedDecisionId,
        transactionId: producedTransactionId,
        policyBundleId: policy.id,
        policyVersion: policy.version,
        contentHash: policy.contentHash,
        riskLevel: evaluated.risk.level,
        riskReasonCodes: evaluated.risk.reasonCodes,
        action: evaluated.action,
        selectedFactorId: evaluated.selectedFactorId,
        evidence,
        threats: evaluated.threats,
        trust: evaluated.trust,
        factors: evaluated.factors,
        trace: evaluated.trace,
        createdAt: nowIso,
      });

      this.replays.create({
        id: replayId,
        sourceDecisionId: decisionId,
        mode: req.mode,
        policyVersion: policy.version,
        producedDecisionId,
        createdAt: nowIso,
        evidenceChanges: req.evidenceChanges ?? [],
        capabilityChanges: req.capabilityChanges ?? [],
      });

      // Persist the structured diff against the immutable source.
      const produced = this.decisions.findById(producedDecisionId);
      if (produced) {
        const diff = buildDecisionDiff(replayId, decisionId, source, produced, sourcePolicy, policy);
        this.replays.saveDiff(replayId, decisionId, diff);
      }
    });
    apply();

    const record = this.replays.findById(replayId);
    if (!record) {
      throw replayError("Replay was not persisted");
    }
    return record;
  }

  getReplay(replayId: string): { replay: ReplayRecord; decision: DecisionResponse } | undefined {
    const replay = this.replays.findById(replayId);
    if (!replay) return undefined;
    const decision = this.decisions.findById(replay.producedDecisionId);
    if (!decision) return undefined;
    return { replay, decision };
  }

  getDiff(replayId: string): DecisionDiff | undefined {
    return this.replays.findDiff(replayId);
  }
}
