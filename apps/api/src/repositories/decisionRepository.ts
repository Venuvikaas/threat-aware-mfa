/**
 * Decision + factor-evaluation persistence (docs/EXECUTION.md Phase 1).
 * The decision service wraps the inserts in one database transaction so the
 * transaction, decision, factor evaluations, and audit trail are atomic.
 */
import type { Db } from "../db/connection.js";
import { parseJson } from "../lib/ids.js";
import type {
  DecisionAction,
  FactorId,
  FactorStatus,
  RiskLevel,
  ThreatSupport,
  ThreatType,
} from "@mfa/contracts";

export interface FactorEvaluationRow {
  factor: FactorId;
  status: FactorStatus;
  reasonCode: string;
  reason: string;
}

export interface DecisionRow {
  id: string;
  transactionId: string;
  policyVersion: string;
  riskLevel: RiskLevel;
  riskReasons: string[];
  threatType: ThreatType;
  threatSupport: ThreatSupport;
  threatEvidence: string[];
  allowedFactors: FactorId[];
  blockedFactors: FactorId[];
  selectedFactor: FactorId | null;
  action: DecisionAction;
  createdAt: string;
  factorEvaluations: FactorEvaluationRow[];
}

interface DecisionRecord {
  id: string;
  transaction_id: string;
  policy_version: string;
  risk_level: string;
  risk_reasons_json: string;
  threat_type: string;
  threat_support: string;
  threat_evidence_json: string;
  allowed_factors_json: string;
  blocked_factors_json: string;
  selected_factor: string | null;
  action: string;
  created_at: string;
}

interface FactorRecord {
  factor: string;
  status: string;
  reason_code: string;
  reason: string;
}

function toDecision(row: DecisionRecord, factors: FactorRecord[]): DecisionRow {
  return {
    id: row.id,
    transactionId: row.transaction_id,
    policyVersion: row.policy_version,
    riskLevel: row.risk_level as RiskLevel,
    riskReasons: parseJson<string[]>(row.risk_reasons_json) ?? [],
    threatType: row.threat_type as ThreatType,
    threatSupport: row.threat_support as ThreatSupport,
    threatEvidence: parseJson<string[]>(row.threat_evidence_json) ?? [],
    allowedFactors: parseJson<FactorId[]>(row.allowed_factors_json) ?? [],
    blockedFactors: parseJson<FactorId[]>(row.blocked_factors_json) ?? [],
    selectedFactor: row.selected_factor as FactorId | null,
    action: row.action as DecisionAction,
    createdAt: row.created_at,
    factorEvaluations: factors.map((f) => ({
      factor: f.factor as FactorId,
      status: f.status as FactorStatus,
      reasonCode: f.reason_code,
      reason: f.reason,
    })),
  };
}

export class DecisionRepository {
  constructor(private readonly db: Db) {}

  insertDecision(input: DecisionRow): void {
    this.db
      .prepare(
        `INSERT INTO decisions (id, transaction_id, policy_version, risk_level, risk_reasons_json,
           threat_type, threat_support, threat_evidence_json, allowed_factors_json,
           blocked_factors_json, selected_factor, action, created_at)
         VALUES (@id, @transactionId, @policyVersion, @riskLevel, @riskReasons,
           @threatType, @threatSupport, @threatEvidence, @allowedFactors,
           @blockedFactors, @selectedFactor, @action, @createdAt)`
      )
      .run({
        ...input,
        riskReasons: JSON.stringify(input.riskReasons),
        threatEvidence: JSON.stringify(input.threatEvidence),
        allowedFactors: JSON.stringify(input.allowedFactors),
        blockedFactors: JSON.stringify(input.blockedFactors),
      });
    if (input.factorEvaluations.length > 0) {
      this.insertFactorEvaluations(input.id, input.factorEvaluations);
    }
  }

  insertFactorEvaluations(decisionId: string, factors: FactorEvaluationRow[]): void {
    const stmt = this.db.prepare(
      `INSERT INTO factor_evaluations (decision_id, factor, status, reason_code, reason)
       VALUES (?, ?, ?, ?, ?)`
    );
    for (const f of factors) {
      stmt.run(decisionId, f.factor, f.status, f.reasonCode, f.reason);
    }
  }

  findById(id: string): DecisionRow | undefined {
    const row = this.db
      .prepare("SELECT * FROM decisions WHERE id = ?")
      .get(id) as DecisionRecord | undefined;
    if (!row) return undefined;
    const factors = this.db
      .prepare(
        "SELECT factor, status, reason_code, reason FROM factor_evaluations WHERE decision_id = ?"
      )
      .all(id) as FactorRecord[];
    return toDecision(row, factors);
  }

  findByTransactionId(transactionId: string): DecisionRow | undefined {
    const row = this.db
      .prepare("SELECT * FROM decisions WHERE transaction_id = ?")
      .get(transactionId) as DecisionRecord | undefined;
    if (!row) return undefined;
    const factors = this.db
      .prepare(
        "SELECT factor, status, reason_code, reason FROM factor_evaluations WHERE decision_id = ?"
      )
      .all(row.id) as FactorRecord[];
    return toDecision(row, factors);
  }
}
