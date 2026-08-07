/**
 * Evidence persistence (EXECUTION_new2.md Phase 2).
 *
 * Evidence is bound to a decision and preserves full provenance: provider,
 * observation time, quality, synthetic status, and the computed status that
 * drove the evaluation.
 */
import type { EvidenceItem } from "@mfa/contracts";
import type { Db } from "../db/connection.js";
import { parseJson } from "../lib/ids.js";

export class EvidenceRepository {
  constructor(private readonly db: Db) {}

  insertMany(decisionId: string, evidence: EvidenceItem[]): void {
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

  findByDecisionId(decisionId: string): EvidenceItem[] {
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
}
