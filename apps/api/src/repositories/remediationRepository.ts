/**
 * Verified remediation persistence (EXECUTION_new2.md Phase 7).
 *
 * Only replay-verified change sets are stored — never templated promises.
 */
import type { FactorId, FactorRemediation, RemediationChangeSet, RemediationStatus } from "@mfa/contracts";
import type { Db } from "../db/connection.js";
import { parseJson } from "../lib/ids.js";

export interface RemediationInput {
  id: string;
  decisionId: string;
  factorId: FactorId;
  status: RemediationStatus;
  changeSets: RemediationChangeSet[];
  explanationCode: string;
  createdAt: string;
}

export class RemediationRepository {
  constructor(private readonly db: Db) {}

  insert(input: RemediationInput): FactorRemediation {
    this.db
      .prepare(
        `INSERT INTO verified_remediations (id, decision_id, factor_id, status, change_sets_json, explanation_code, created_at)
         VALUES (@id, @decisionId, @factorId, @status, @changeSets, @explanationCode, @createdAt)`
      )
      .run({
        ...input,
        changeSets: JSON.stringify(input.changeSets),
      });
    return {
      factorId: input.factorId,
      status: input.status,
      changeSets: input.changeSets,
      explanationCode: input.explanationCode,
    };
  }

  findByDecision(decisionId: string): FactorRemediation[] {
    const rows = this.db
      .prepare("SELECT * FROM verified_remediations WHERE decision_id = ? ORDER BY rowid")
      .all(decisionId) as {
      factor_id: string;
      status: string;
      change_sets_json: string;
      explanation_code: string;
    }[];
    return rows.map((r) => ({
      factorId: r.factor_id as FactorId,
      status: r.status as RemediationStatus,
      changeSets: parseJson<RemediationChangeSet[]>(r.change_sets_json) ?? [],
      explanationCode: r.explanation_code,
    }));
  }
}
