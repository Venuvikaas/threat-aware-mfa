/**
 * Verified remediation service (EXECUTION_new2.md §5.5, Phase 7).
 *
 * Derives candidate remediation change sets from the factor's failed
 * requirements and verifies each by replaying the decision under the changed
 * inputs. Only replay-verified results are persisted and returned — never
 * templated promises. Precise claims: wouldBecomeEligible / wouldBeSelected
 * only when the replay proves them.
 */
import type { FactorId, RemediationResponse } from "@mfa/contracts";
import { verifyFactorRemediation } from "@mfa/decision-core";
import type { Db } from "../db/connection.js";
import { newId } from "../lib/ids.js";
import { notFoundError } from "../middleware/errorHandler.js";
import { CapabilityRepository } from "../repositories/capabilityRepository.js";
import { DecisionRepository } from "../repositories/decisionRepository.js";
import { PolicyRepository } from "../repositories/policyRepository.js";
import { RemediationRepository } from "../repositories/remediationRepository.js";
import { TransactionRepository } from "../repositories/transactionRepository.js";

export class RemediationService {
  private readonly decisions: DecisionRepository;
  private readonly transactions: TransactionRepository;
  private readonly policies: PolicyRepository;
  private readonly capabilities: CapabilityRepository;
  private readonly remediations: RemediationRepository;

  constructor(db: Db) {
    this.decisions = new DecisionRepository(db);
    this.transactions = new TransactionRepository(db);
    this.policies = new PolicyRepository(db);
    this.capabilities = new CapabilityRepository(db);
    this.remediations = new RemediationRepository(db);
  }

  verify(decisionId: string, factorId: FactorId): RemediationResponse {
    const decision = this.decisions.findById(decisionId);
    if (!decision) {
      throw notFoundError(`Decision ${decisionId} not found`);
    }

    const transaction = this.transactions.findById(decision.transactionId);
    if (!transaction) {
      throw notFoundError(`Transaction for decision ${decisionId} not found`);
    }

    const policy = this.policies.findByVersion(decision.policy.version);
    if (!policy) {
      throw notFoundError(`Policy version ${decision.policy.version} not found`);
    }

    const factor = policy.factorDefinitions.find((f) => f.id === factorId);
    if (!factor) {
      throw notFoundError(`Factor ${factorId} not found in policy ${policy.version}`);
    }

    const factorEvaluation = decision.factors.find((f) => f.factorId === factorId);
    if (!factorEvaluation) {
      throw notFoundError(`Factor ${factorId} was not evaluated for decision ${decisionId}`);
    }

    const capabilities = this.capabilities.findByUserId(transaction.userId);
    const result = verifyFactorRemediation({
      factorId,
      factor,
      factorEvaluation,
      evidence: decision.evidence,
      capabilities,
      policy,
      evaluatedAt: decision.createdAt,
      selectedFactorId: decision.selectedFactorId,
      trust: decision.trust,
    });

    this.remediations.insert({
      id: newId("rem"),
      decisionId,
      factorId,
      status: result.status,
      changeSets: result.changeSets,
      explanationCode: result.explanationCode,
      createdAt: new Date().toISOString(),
    });

    // Precise claim language: "would become eligible" only describes a change
    // proven by replay. An already-eligible factor did not become eligible
    // through remediation — it already was — so wouldBecomeEligible is false
    // and only the actual selection state is reported.
    const alreadyEligible = result.explanationCode === "already_eligible";
    return {
      decisionId,
      factorId,
      verified: result.status !== "REMAINS_INELIGIBLE",
      wouldBecomeEligible:
        !alreadyEligible &&
        (result.status === "VERIFIED_ELIGIBLE" || result.status === "VERIFIED_SELECTED"),
      wouldBeSelected: result.status === "VERIFIED_SELECTED",
      changeSets: result.changeSets,
    };
  }
}
