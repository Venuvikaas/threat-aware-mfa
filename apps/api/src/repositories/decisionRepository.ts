/**
 * Decision-graph persistence (EXECUTION_new2.md Phase 2/3).
 *
 * One decision record plus its complete reasoning graph: evidence, threat
 * assessments, trust assessments, factor evaluations, failed requirements,
 * and the append-only trace. The service wraps `persist` in one database
 * transaction; `findById` reconstructs the full DecisionResponse shape.
 */
import type {
  DecisionResponse,
  EvidenceItem,
  FactorEvaluation,
  RuleTraceEvent,
  ThreatAssessment,
  TrustAssessment,
} from "@mfa/contracts";
import type { Db } from "../db/connection.js";
import { parseJson } from "../lib/ids.js";

export interface DecisionPersistInput {
  id: string;
  transactionId: string;
  policyBundleId: string;
  policyVersion: string;
  contentHash: string;
  riskLevel: DecisionResponse["risk"]["level"];
  riskReasonCodes: string[];
  action: DecisionResponse["action"];
  selectedFactorId: string | null;
  evidence: EvidenceItem[];
  threats: ThreatAssessment[];
  trust: TrustAssessment[];
  factors: FactorEvaluation[];
  trace: RuleTraceEvent[];
  createdAt: string;
}

interface DecisionRecord {
  id: string;
  transaction_id: string;
  policy_bundle_id: string;
  policy_version: string;
  content_hash: string;
  risk_level: string;
  action: string;
  selected_factor_id: string | null;
  created_at: string;
}

export class DecisionRepository {
  constructor(private readonly db: Db) {}

  persist(input: DecisionPersistInput): void {
    this.db
      .prepare(
        `INSERT INTO decisions (id, transaction_id, policy_bundle_id, policy_version,
           content_hash, risk_level, risk_reason_codes_json, action, selected_factor_id, created_at)
         VALUES (@id, @transactionId, @policyBundleId, @policyVersion, @contentHash,
           @riskLevel, @riskReasonCodes, @action, @selectedFactorId, @createdAt)`
      )
      .run({
        id: input.id,
        transactionId: input.transactionId,
        policyBundleId: input.policyBundleId,
        policyVersion: input.policyVersion,
        contentHash: input.contentHash,
        riskLevel: input.riskLevel,
        riskReasonCodes: JSON.stringify(input.riskReasonCodes),
        action: input.action,
        selectedFactorId: input.selectedFactorId,
        createdAt: input.createdAt,
      });

    this.insertEvidence(input.id, input.evidence);
    this.insertThreats(input.id, input.threats);
    this.insertTrust(input.id, input.trust);
    this.insertFactors(input.id, input.factors);
    this.insertTrace(input.id, input.trace);
  }

  findById(id: string): DecisionResponse | undefined {
    const row = this.db
      .prepare("SELECT * FROM decisions WHERE id = ?")
      .get(id) as DecisionRecord | undefined;
    if (!row) return undefined;
    return this.toResponse(row);
  }

  findByTransactionId(transactionId: string): DecisionResponse | undefined {
    const row = this.db
      .prepare("SELECT * FROM decisions WHERE transaction_id = ?")
      .get(transactionId) as DecisionRecord | undefined;
    if (!row) return undefined;
    return this.toResponse(row);
  }

  /** Reconstruct the full response shape from a decision row. */
  toResponse(row: DecisionRecord): DecisionResponse {
    return {
      decisionId: row.id,
      transactionId: row.transaction_id,
      policy: {
        bundleId: row.policy_bundle_id,
        version: row.policy_version,
        contentHash: row.content_hash,
      },
      risk: { level: row.risk_level as DecisionResponse["risk"]["level"], reasonCodes: this.riskReasonCodes(row.id) },
      evidence: this.evidenceFor(row.id),
      threats: this.threatsFor(row.id),
      trust: this.trustFor(row.id),
      factors: this.factorsFor(row.id),
      selectedFactorId: row.selected_factor_id as DecisionResponse["selectedFactorId"],
      action: row.action as DecisionResponse["action"],
      trace: this.traceFor(row.id),
      createdAt: row.created_at,
    };
  }

  /* ---- child tables ---- */

  private insertEvidence(decisionId: string, evidence: EvidenceItem[]): void {
    const stmt = this.db.prepare(
      `INSERT INTO evidence_items (decision_id, evidence_id, type, value_json, provider_id,
         provider_type, observed_at, valid_until, synthetic, quality, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const e of evidence) {
      stmt.run(
        decisionId,
        e.id,
        e.type,
        JSON.stringify(e.value),
        e.providerId,
        e.providerType,
        e.observedAt,
        e.validUntil,
        e.synthetic ? 1 : 0,
        e.quality,
        e.status
      );
    }
  }

  private insertThreats(decisionId: string, threats: ThreatAssessment[]): void {
    const stmt = this.db.prepare(
      `INSERT INTO threat_assessments (decision_id, threat_id, support,
         supporting_evidence_json, conflicting_evidence_json, activated_rule_ids_json)
       VALUES (?, ?, ?, ?, ?, ?)`
    );
    for (const t of threats) {
      stmt.run(
        decisionId,
        t.threatId,
        t.support,
        JSON.stringify(t.supportingEvidenceIds),
        JSON.stringify(t.conflictingEvidenceIds),
        JSON.stringify(t.activatedRuleIds)
      );
    }
  }

  private insertTrust(decisionId: string, trust: TrustAssessment[]): void {
    const stmt = this.db.prepare(
      `INSERT INTO trust_assessments (decision_id, domain_id, state, evidence_ids_json,
         threat_ids_json, activated_rule_ids_json)
       VALUES (?, ?, ?, ?, ?, ?)`
    );
    for (const t of trust) {
      stmt.run(
        decisionId,
        t.domainId,
        t.state,
        JSON.stringify(t.evidenceIds),
        JSON.stringify(t.threatIds),
        JSON.stringify(t.activatedRuleIds)
      );
    }
  }

  private insertFactors(decisionId: string, factors: FactorEvaluation[]): void {
    const stmt = this.db.prepare(
      `INSERT INTO factor_evaluations (decision_id, factor_id, status, assurance_satisfied,
         friction_tier, trace_event_ids_json)
       VALUES (?, ?, ?, ?, ?, ?)`
    );
    const reqStmt = this.db.prepare(
      `INSERT INTO failed_requirements (decision_id, factor_id, kind, requirement_id,
         actual_state, required_state, evidence_ids_json, rule_ids_json, reason_code)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const f of factors) {
      stmt.run(
        decisionId,
        f.factorId,
        f.status,
        f.assuranceSatisfied ? 1 : 0,
        f.frictionTier,
        JSON.stringify(f.traceEventIds)
      );
      for (const req of f.failedRequirements) {
        reqStmt.run(
          decisionId,
          f.factorId,
          req.kind,
          req.requirementId,
          req.actualState,
          req.requiredState,
          JSON.stringify(req.evidenceIds),
          JSON.stringify(req.ruleIds),
          req.reasonCode
        );
      }
    }
  }

  private insertTrace(decisionId: string, trace: RuleTraceEvent[]): void {
    const stmt = this.db.prepare(
      `INSERT INTO trace_events (decision_id, event_id, phase, rule_id, rule_version,
         input_refs_json, output_refs_json, explanation_code, sequence)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const e of trace) {
      stmt.run(
        decisionId,
        e.id,
        e.phase,
        e.ruleId,
        e.ruleVersion,
        JSON.stringify(e.inputRefs),
        JSON.stringify(e.outputRefs),
        e.explanationCode,
        e.sequence
      );
    }
  }

  /* ---- reads ---- */

  private riskReasonCodes(decisionId: string): string[] {
    // Risk reason codes were derived from risk rules; re-derive from trace? We
    // persist them alongside the decision record via a JSON column on the
    // decisions table instead — see findById usage of risk_reason_codes_json.
    return parseJson<string[]>(
      (this.db.prepare("SELECT risk_reason_codes_json FROM decisions WHERE id = ?").get(decisionId) as
        | { risk_reason_codes_json: string | null }
        | undefined)?.risk_reason_codes_json ?? null
    ) ?? [];
  }

  private evidenceFor(decisionId: string): EvidenceItem[] {
    const rows = this.db
      .prepare("SELECT * FROM evidence_items WHERE decision_id = ? ORDER BY rowid")
      .all(decisionId) as {
      evidence_id: string;
      type: string;
      value_json: string;
      provider_id: string;
      provider_type: string;
      observed_at: string;
      valid_until: string | null;
      synthetic: number;
      quality: string;
      status: string;
    }[];
    return rows.map((r) => ({
      id: r.evidence_id,
      type: r.type as EvidenceItem["type"],
      value: parseJson<EvidenceItem["value"]>(r.value_json) ?? null,
      providerId: r.provider_id,
      providerType: r.provider_type,
      observedAt: r.observed_at,
      validUntil: r.valid_until,
      synthetic: r.synthetic === 1,
      quality: r.quality as EvidenceItem["quality"],
      status: r.status as EvidenceItem["status"],
    }));
  }

  private threatsFor(decisionId: string): ThreatAssessment[] {
    const rows = this.db
      .prepare("SELECT * FROM threat_assessments WHERE decision_id = ? ORDER BY rowid")
      .all(decisionId) as {
      threat_id: string;
      support: string;
      supporting_evidence_json: string;
      conflicting_evidence_json: string;
      activated_rule_ids_json: string;
    }[];
    return rows.map((r) => ({
      threatId: r.threat_id as ThreatAssessment["threatId"],
      support: r.support as ThreatAssessment["support"],
      supportingEvidenceIds: parseJson<string[]>(r.supporting_evidence_json) ?? [],
      conflictingEvidenceIds: parseJson<string[]>(r.conflicting_evidence_json) ?? [],
      activatedRuleIds: parseJson<string[]>(r.activated_rule_ids_json) ?? [],
    }));
  }

  private trustFor(decisionId: string): TrustAssessment[] {
    const rows = this.db
      .prepare("SELECT * FROM trust_assessments WHERE decision_id = ? ORDER BY rowid")
      .all(decisionId) as {
      domain_id: string;
      state: string;
      evidence_ids_json: string;
      threat_ids_json: string;
      activated_rule_ids_json: string;
    }[];
    return rows.map((r) => ({
      domainId: r.domain_id as TrustAssessment["domainId"],
      state: r.state as TrustAssessment["state"],
      evidenceIds: parseJson<string[]>(r.evidence_ids_json) ?? [],
      threatIds: parseJson<string[]>(r.threat_ids_json) ?? [],
      activatedRuleIds: parseJson<string[]>(r.activated_rule_ids_json) ?? [],
    }));
  }

  private factorsFor(decisionId: string): FactorEvaluation[] {
    const rows = this.db
      .prepare("SELECT * FROM factor_evaluations WHERE decision_id = ? ORDER BY rowid")
      .all(decisionId) as {
      factor_id: string;
      status: string;
      assurance_satisfied: number;
      friction_tier: string;
      trace_event_ids_json: string;
    }[];
    return rows.map((r) => ({
      factorId: r.factor_id as FactorEvaluation["factorId"],
      status: r.status as FactorEvaluation["status"],
      failedRequirements: this.failedRequirementsFor(decisionId, r.factor_id),
      assuranceSatisfied: r.assurance_satisfied === 1,
      frictionTier: r.friction_tier as FactorEvaluation["frictionTier"],
      traceEventIds: parseJson<string[]>(r.trace_event_ids_json) ?? [],
    }));
  }

  private failedRequirementsFor(decisionId: string, factorId: string): FactorEvaluation["failedRequirements"] {
    const rows = this.db
      .prepare(
        `SELECT * FROM failed_requirements WHERE decision_id = ? AND factor_id = ? ORDER BY rowid`
      )
      .all(decisionId, factorId) as {
      kind: string;
      requirement_id: string;
      actual_state: string;
      required_state: string;
      evidence_ids_json: string;
      rule_ids_json: string;
      reason_code: string;
    }[];
    return rows.map((r) => ({
      kind: r.kind as FactorEvaluation["failedRequirements"][number]["kind"],
      requirementId: r.requirement_id,
      actualState: r.actual_state,
      requiredState: r.required_state,
      evidenceIds: parseJson<string[]>(r.evidence_ids_json) ?? [],
      ruleIds: parseJson<string[]>(r.rule_ids_json) ?? [],
      reasonCode: r.reason_code,
    }));
  }

  private traceFor(decisionId: string): RuleTraceEvent[] {
    const rows = this.db
      .prepare("SELECT * FROM trace_events WHERE decision_id = ? ORDER BY sequence")
      .all(decisionId) as {
      event_id: string;
      phase: string;
      rule_id: string;
      rule_version: string;
      input_refs_json: string;
      output_refs_json: string;
      explanation_code: string;
      sequence: number;
    }[];
    return rows.map((r) => ({
      id: r.event_id,
      phase: r.phase as RuleTraceEvent["phase"],
      ruleId: r.rule_id,
      ruleVersion: r.rule_version,
      inputRefs: parseJson<string[]>(r.input_refs_json) ?? [],
      outputRefs: parseJson<string[]>(r.output_refs_json) ?? [],
      explanationCode: r.explanation_code,
      sequence: r.sequence,
    }));
  }
}
