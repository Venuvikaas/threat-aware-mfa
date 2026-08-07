/**
 * Decision service (docs/EXECUTION.md Phase 3).
 *
 * Orchestration: load/create synthetic demo entities, collect signals through
 * the provider boundary (with demo overrides), evaluate risk, threat, and
 * policy, then persist the transaction, signals, decision, factor
 * evaluations, and audit events atomically in one database transaction.
 */
import type {
  AuditEvent,
  CreateDecisionRequest,
  CreateDecisionResponse,
} from "@mfa/contracts";
import { DEMO_POLICY, evaluatePolicy, evaluateRisk, evaluateThreat } from "@mfa/decision-core";
import type { Db } from "../db/connection.js";
import { newId } from "../lib/ids.js";
import { conflictError, notFoundError } from "../middleware/errorHandler.js";
import { collectSignals, DEFAULT_SIGNAL_PROVIDERS } from "../providers/mockSignalProvider.js";
import type { SignalProvider, SignalValue } from "../providers/signalProvider.js";
import { AuditRepository } from "../repositories/auditRepository.js";
import { DecisionRepository, type DecisionRow } from "../repositories/decisionRepository.js";
import { DeviceRepository } from "../repositories/deviceRepository.js";
import { SessionRepository } from "../repositories/sessionRepository.js";
import {
  SignalRepository,
  TransactionRepository,
} from "../repositories/transactionRepository.js";
import { UserRepository } from "../repositories/userRepository.js";

export class DecisionService {
  private readonly users: UserRepository;
  private readonly devices: DeviceRepository;
  private readonly sessions: SessionRepository;
  private readonly transactions: TransactionRepository;
  private readonly signals: SignalRepository;
  private readonly decisions: DecisionRepository;
  private readonly audit: AuditRepository;

  constructor(
    private readonly db: Db,
    private readonly demoMode: boolean,
    private readonly signalProviders: SignalProvider[] = DEFAULT_SIGNAL_PROVIDERS
  ) {
    this.users = new UserRepository(db);
    this.devices = new DeviceRepository(db);
    this.sessions = new SessionRepository(db);
    this.transactions = new TransactionRepository(db);
    this.signals = new SignalRepository(db);
    this.decisions = new DecisionRepository(db);
    this.audit = new AuditRepository(db);
  }

  createDecision(req: CreateDecisionRequest): CreateDecisionResponse {
    const now = new Date().toISOString();

    // Idempotency: repeated client transaction ids must not create conflicts.
    const existingTxn = this.transactions.findByClientTransactionId(
      req.transaction.clientTransactionId
    );
    if (existingTxn) {
      throw conflictError("Duplicate client transaction id", {
        transactionId: existingTxn.id,
        decisionId: this.decisions.findByTransactionId(existingTxn.id)?.id ?? null,
      });
    }

    const user = this.users.findById(req.userId);
    if (!user) {
      throw notFoundError(`User ${req.userId} not found`);
    }

    // Load or create synthetic demo entities.
    this.devices.upsert({
      id: req.device.deviceId,
      userId: req.userId,
      trusted: req.device.trusted,
      browserFingerprint: req.device.browserFingerprint,
      firstSeenAt: now,
      lastSeenAt: now,
    });
    this.sessions.upsert({
      id: req.session.sessionId,
      userId: req.userId,
      deviceId: req.device.deviceId,
      ipAddress: req.session.ipAddress,
      asn: req.session.asn,
      country: req.session.country,
      startedAt: now,
      failedLoginCount: req.session.failedLoginCount,
    });

    // Collect signals through the provider boundary (demo overrides only in
    // demo mode; provider failure yields an explicit unknown signal).
    const signals = collectSignals(
      this.signalProviders,
      { userId: req.userId, deviceId: req.device.deviceId },
      this.demoMode,
      {
        recentSimChange: req.signals.recentSimChange,
        geoDistanceFromLastLoginKm: req.signals.geoDistanceFromLastLoginKm,
      },
      req.signals.phishingRelayIndicator,
      req.device.firstSeen,
      now
    );

    const risk = evaluateRisk({
      amountMinor: req.transaction.amountMinor,
      payeeIsKnown: req.transaction.payeeIsKnown,
      firstSeen: req.device.firstSeen,
      failedLoginCount: req.session.failedLoginCount,
      sessionAgeSeconds: req.session.ageSeconds,
      recentSimChange: signals.recentSimChange,
      geoDistanceFromLastLoginKm: signals.geoDistanceFromLastLoginKm,
      phishingRelayIndicator: signals.phishingRelayIndicator,
    });

    const threat = evaluateThreat({
      recentSimChange: signals.recentSimChange,
      phishingRelayIndicator: signals.phishingRelayIndicator,
      firstSeen: req.device.firstSeen,
      payeeIsKnown: req.transaction.payeeIsKnown,
      amountMinor: req.transaction.amountMinor,
      failedLoginCount: req.session.failedLoginCount,
      sessionAgeSeconds: req.session.ageSeconds,
    });

    const policy = evaluatePolicy({
      riskLevel: risk.level,
      threatType: threat.type,
      passkeyEnrolled: user.passkeyEnrolled,
    });

    const transactionId = newId("txn");
    const decisionId = newId("dec");

    const persist = this.db.transaction(() => {
      this.transactions.create({
        id: transactionId,
        clientTransactionId: req.transaction.clientTransactionId,
        userId: req.userId,
        amountMinor: req.transaction.amountMinor,
        currency: req.transaction.currency,
        payeeId: req.transaction.payeeId,
        payeeIsKnown: req.transaction.payeeIsKnown,
        status: "PENDING",
        createdAt: now,
      });

      this.signals.insertMany(transactionId, signals.list);

      this.decisions.insertDecision({
        id: decisionId,
        transactionId,
        policyVersion: DEMO_POLICY.version,
        riskLevel: risk.level,
        riskReasons: risk.reasons,
        threatType: threat.type,
        threatSupport: threat.support,
        threatEvidence: threat.evidence,
        allowedFactors: policy.allowedFactors,
        blockedFactors: policy.blockedFactors,
        selectedFactor: policy.selectedFactor,
        action: policy.action,
        createdAt: now,
        factorEvaluations: policy.factors,
      });

      this.audit.insert({
        decisionId,
        eventType: "DECISION_CREATED",
        reasonCode: "decision_recorded",
        details: { riskLevel: risk.level, threatType: threat.type },
        createdAt: now,
      });
      for (const f of policy.factors.filter((f) => f.status === "BLOCKED")) {
        this.audit.insert({
          decisionId,
          eventType: "FACTOR_BLOCKED",
          reasonCode: f.reasonCode,
          details: { factor: f.factor },
          createdAt: now,
        });
      }
      if (policy.selectedFactor) {
        this.audit.insert({
          decisionId,
          eventType: "FACTOR_SELECTED",
          reasonCode: "factor_selected",
          details: { factor: policy.selectedFactor },
          createdAt: now,
        });
      } else {
        this.audit.insert({
          decisionId,
          eventType: "RECOVERY_REQUIRED",
          reasonCode: "assisted_recovery",
          details: {},
          createdAt: now,
        });
      }
    });
    persist();

    return this.toResponse(
      decisionId,
      transactionId,
      risk.level,
      risk.reasons,
      threat.type,
      threat.support,
      threat.evidence,
      policy.factors,
      policy.allowedFactors,
      policy.blockedFactors,
      policy.selectedFactor,
      policy.action,
      now
    );
  }

  getDecision(decisionId: string): CreateDecisionResponse | undefined {
    const row = this.decisions.findById(decisionId);
    if (!row) return undefined;
    return this.toResponse(
      row.id,
      row.transactionId,
      row.riskLevel,
      row.riskReasons,
      row.threatType,
      row.threatSupport,
      row.threatEvidence,
      row.factorEvaluations,
      row.allowedFactors,
      row.blockedFactors,
      row.selectedFactor,
      row.action,
      row.createdAt
    );
  }

  getAudit(decisionId: string): AuditEvent[] | undefined {
    if (!this.decisions.findById(decisionId)) return undefined;
    return this.audit.listByDecision(decisionId);
  }

  /** Persisted signal provenance for a decision (synthetic disclosure). */
  getSignals(decisionId: string): SignalValue[] | undefined {
    const row = this.decisions.findById(decisionId);
    if (!row) return undefined;
    return this.signals.findByTransactionId(row.transactionId);
  }

  private toResponse(
    decisionId: string,
    transactionId: string,
    riskLevel: CreateDecisionResponse["risk"]["level"],
    riskReasons: string[],
    threatType: CreateDecisionResponse["threat"]["type"],
    threatSupport: CreateDecisionResponse["threat"]["support"],
    threatEvidence: string[],
    factors: DecisionRow["factorEvaluations"],
    allowedFactors: CreateDecisionResponse["allowedFactors"],
    blockedFactors: CreateDecisionResponse["blockedFactors"],
    selectedFactor: CreateDecisionResponse["selectedFactor"],
    action: CreateDecisionResponse["action"],
    createdAt: string
  ): CreateDecisionResponse {
    return {
      decisionId,
      transactionId,
      policyVersion: DEMO_POLICY.version,
      risk: { level: riskLevel, reasons: riskReasons },
      threat: { type: threatType, support: threatSupport, evidence: threatEvidence },
      factors,
      allowedFactors,
      blockedFactors,
      selectedFactor,
      action,
      createdAt,
    };
  }
}
