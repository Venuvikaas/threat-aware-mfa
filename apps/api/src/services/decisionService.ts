/**
 * Decision orchestration service (EXECUTION_new2.md Phase 3).
 *
 * - Collects evidence through the provider boundary (mock telecom/device/
 *   session/geo), derives transaction-context evidence, applies demo-only
 *   overrides, and preserves full provenance (provider id, type, observed
 *   time, quality, synthetic status).
 * - Loads the requested immutable policy bundle (hash-verified) or the active
 *   one.
 * - Runs the pure decision engine, then persists the transaction + full
 *   decision graph atomically in one database transaction.
 * - Enforces client-transaction idempotency (409 on duplicates).
 */
import type {
  CreateDecisionRequest,
  DecisionResponse,
  EvidenceItem,
  EvidenceOverride,
  EvidenceType,
} from "@mfa/contracts";
import { normalizeEvidence, evaluateDecision, type RawEvidence } from "@mfa/decision-core";
import type { Db } from "../db/connection.js";
import { newId } from "../lib/ids.js";
import { conflictError, notFoundError } from "../middleware/errorHandler.js";
import { DEFAULT_EVIDENCE_PROVIDERS } from "../providers/mockSessionProvider.js";
import type { EvidenceProvider, ProviderContext } from "../providers/evidenceProvider.js";
import { CapabilityRepository } from "../repositories/capabilityRepository.js";
import { DecisionRepository } from "../repositories/decisionRepository.js";
import { DeviceRepository } from "../repositories/deviceRepository.js";
import { PolicyRepository } from "../repositories/policyRepository.js";
import { SessionRepository } from "../repositories/sessionRepository.js";
import { TransactionRepository } from "../repositories/transactionRepository.js";
import { UserRepository } from "../repositories/userRepository.js";

const SIM_CHANGE_VALID_FOR_MS = 60 * 60 * 1000; // recent SIM change: 1h window

export class DecisionService {
  private readonly users: UserRepository;
  private readonly devices: DeviceRepository;
  private readonly sessions: SessionRepository;
  private readonly transactions: TransactionRepository;
  private readonly decisions: DecisionRepository;
  private readonly policies: PolicyRepository;
  private readonly capabilities: CapabilityRepository;

  constructor(
    private readonly db: Db,
    private readonly demoMode: boolean,
    private readonly providers: EvidenceProvider[] = DEFAULT_EVIDENCE_PROVIDERS
  ) {
    this.users = new UserRepository(db);
    this.devices = new DeviceRepository(db);
    this.sessions = new SessionRepository(db);
    this.transactions = new TransactionRepository(db);
    this.decisions = new DecisionRepository(db);
    this.policies = new PolicyRepository(db);
    this.capabilities = new CapabilityRepository(db);
  }

  createDecision(req: CreateDecisionRequest): DecisionResponse {
    const now = new Date();
    const nowIso = now.toISOString();

    // Idempotency: repeated client transaction ids must not create conflicts.
    const existingTxn = this.transactions.findByClientTransactionId(req.clientTransactionId);
    if (existingTxn) {
      throw conflictError("Duplicate client transaction id", {
        transactionId: existingTxn.id,
        decisionId: this.decisions.findByTransactionId(existingTxn.id)?.decisionId ?? null,
      });
    }

    const user = this.users.findById(req.userId);
    if (!user) {
      throw notFoundError(`User ${req.userId} not found`);
    }

    // Load or upsert synthetic demo entities (first-seen state matters).
    const device = this.devices.upsert({
      id: req.session.deviceId,
      userId: req.userId,
      trusted: false,
      firstSeenAt: this.devices.findById(req.session.deviceId)?.firstSeenAt ?? nowIso,
      lastSeenAt: nowIso,
    });
    this.sessions.upsert({
      id: req.session.sessionId,
      userId: req.userId,
      deviceId: req.session.deviceId,
      ipAddress: req.session.ipAddress,
      asn: req.session.asn,
      country: req.session.country,
      startedAt: nowIso,
      failedLoginCount: req.session.failedLoginCount,
    });

    // Load the policy bundle: requested version (immutable) or the active one.
    const policy = req.policyVersion
      ? this.policies.findByVersion(req.policyVersion)
      : this.policies.findActive();
    if (!policy) {
      throw notFoundError(
        req.policyVersion
          ? `Policy version ${req.policyVersion} not found`
          : "No active policy bundle"
      );
    }

    // Collect evidence with provenance.
    const evidence = this.collectEvidence(req, device.firstSeenAt, now);

    const capabilities = this.capabilities.findByUserId(req.userId);
    const evaluated = evaluateDecision({ evidence, capabilities, policy });

    // Persist atomically: transaction + full decision graph.
    const transactionId = newId("txn");
    const decisionId = newId("dec");
    const persist = this.db.transaction(() => {
      this.transactions.create({
        id: transactionId,
        clientTransactionId: req.clientTransactionId,
        userId: req.userId,
        amountMinor: req.transaction.amountMinor,
        currency: req.transaction.currency,
        payeeId: req.transaction.payeeId,
        payeeIsKnown: req.transaction.payeeIsKnown,
        status: "PENDING",
        createdAt: nowIso,
      });
      this.decisions.persist({
        id: decisionId,
        transactionId,
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
    });
    persist();

    return this.decisions.findById(decisionId)!;
  }

  getDecision(decisionId: string): DecisionResponse | undefined {
    return this.decisions.findById(decisionId);
  }

  getTrace(decisionId: string): DecisionResponse["trace"] | undefined {
    const decision = this.decisions.findById(decisionId);
    return decision?.trace;
  }

  /**
   * Collect and normalize evidence for a decision:
   * provider observations + transaction-context evidence + capability
   * evidence, then demo overrides (demo mode only).
   */
  private collectEvidence(
    req: CreateDecisionRequest,
    firstSeenAt: string,
    now: Date
  ): EvidenceItem[] {
    const nowIso = now.toISOString();
    const ctx: ProviderContext = {
      userId: req.userId,
      deviceId: req.session.deviceId,
      sessionId: req.session.sessionId,
    };

    const raw: RawEvidence[] = [];

    // Provider observations (mock, labeled synthetic, provenance intact).
    for (const provider of this.providers) {
      const observation = provider.collect(ctx);
      raw.push({
        type: observation.type,
        value: observation.value,
        providerId: observation.providerId,
        providerType: observation.providerType,
        observedAt: nowIso,
        validUntil: observation.validUntil ?? null,
        synthetic: true,
        quality: observation.quality,
      });
    }

    // Transaction-context evidence (derived from the request, not a provider).
    raw.push(
      {
        type: "HIGH_VALUE_TRANSACTION",
        value: req.transaction.amountMinor >= 5_000_000,
        providerId: "transaction_context",
        providerType: "transaction",
        observedAt: nowIso,
        validUntil: null,
        synthetic: true,
        quality: "CONFIRMED",
      },
      {
        type: "NEW_PAYEE",
        value: !req.transaction.payeeIsKnown,
        providerId: "transaction_context",
        providerType: "transaction",
        observedAt: nowIso,
        validUntil: null,
        synthetic: true,
        quality: "CONFIRMED",
      },
      {
        type: "FIRST_SEEN_DEVICE",
        value: firstSeenAt === nowIso,
        providerId: "device_profile",
        providerType: "device",
        observedAt: nowIso,
        validUntil: null,
        synthetic: true,
        quality: "CONFIRMED",
      },
      {
        type: "FAILED_LOGIN_BURST",
        value: req.session.failedLoginCount >= 2,
        providerId: "session_context",
        providerType: "session",
        observedAt: nowIso,
        validUntil: null,
        synthetic: true,
        quality: "CONFIRMED",
      }
    );

    // Capability evidence for provenance display (only evidence-modeled
    // capabilities; the capability gate itself reads CapabilityRepository).
    const evidenceModeled = new Set<EvidenceType>(["PASSKEY_ENROLLED", "WEBAUTHN_SUPPORTED", "NETWORK_AVAILABLE"]);
    for (const cap of this.capabilities.findByUserId(req.userId)) {
      if (!evidenceModeled.has(cap.capabilityId as EvidenceType)) continue;
      raw.push({
        type: cap.capabilityId as EvidenceType,
        value: cap.available,
        providerId: "user_capabilities",
        providerType: "capability",
        observedAt: nowIso,
        validUntil: null,
        synthetic: true,
        quality: "CONFIRMED",
      });
    }

    // Demo overrides (demo mode only) replace matching provider evidence and
    // set a validity window for freshness demonstration.
    if (this.demoMode && req.evidenceOverrides) {
      this.applyOverrides(raw, req.evidenceOverrides, nowIso);
    }

    return normalizeEvidence(raw, nowIso);
  }

  private applyOverrides(raw: RawEvidence[], overrides: EvidenceOverride[], nowIso: string): void {
    for (const override of overrides) {
      const index = raw.findIndex((r) => r.type === override.type);
      const replacement: RawEvidence = {
        type: override.type,
        value: override.value,
        providerId: "demo_override",
        providerType: "demo",
        observedAt: nowIso,
        validUntil:
          override.type === "RECENT_SIM_CHANGE" && override.value === true
            ? new Date(new Date(nowIso).getTime() + SIM_CHANGE_VALID_FOR_MS).toISOString()
            : null,
        synthetic: true,
        quality: "CONFIRMED",
      };
      if (index >= 0) {
        raw[index] = replacement;
      } else {
        raw.push(replacement);
      }
    }
  }
}
