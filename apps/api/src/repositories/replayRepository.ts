/**
 * Replay persistence (EXECUTION_new2.md Phase 6).
 *
 * Replays link to an immutable source decision and never mutate it. The
 * produced decision is a full new decision row; replay_changes records the
 * declared fork changes; decision_diffs stores the computed structured diff.
 */
import type { CapabilityOverride, DecisionDiff, EvidenceOverride, ReplayMode, ReplayRecord } from "@mfa/contracts";
import type { Db } from "../db/connection.js";
import { parseJson } from "../lib/ids.js";

export interface ReplayCreateInput {
  id: string;
  sourceDecisionId: string;
  mode: ReplayMode;
  policyVersion: string;
  producedDecisionId: string;
  createdAt: string;
  evidenceChanges: EvidenceOverride[];
  capabilityChanges: CapabilityOverride[];
}

interface ReplayRecordRow {
  id: string;
  source_decision_id: string;
  mode: string;
  policy_version: string;
  produced_decision_id: string;
  created_at: string;
}

export class ReplayRepository {
  constructor(private readonly db: Db) {}

  create(input: ReplayCreateInput): ReplayRecord {
    this.db
      .prepare(
        `INSERT INTO replays (id, source_decision_id, mode, policy_version, produced_decision_id, created_at)
         VALUES (@id, @sourceDecisionId, @mode, @policyVersion, @producedDecisionId, @createdAt)`
      )
      .run({
        id: input.id,
        sourceDecisionId: input.sourceDecisionId,
        mode: input.mode,
        policyVersion: input.policyVersion,
        producedDecisionId: input.producedDecisionId,
        createdAt: input.createdAt,
      });

    const stmt = this.db.prepare(
      `INSERT INTO replay_changes (replay_id, kind, ref, before_json, after_json)
       VALUES (?, ?, ?, ?, ?)`
    );
    for (const change of input.evidenceChanges) {
      stmt.run(input.id, "EVIDENCE", change.type, null, JSON.stringify(change.value));
    }
    for (const change of input.capabilityChanges) {
      stmt.run(input.id, "CAPABILITY", change.capabilityId, null, JSON.stringify(change.available));
    }
    return {
      replayId: input.id,
      sourceDecisionId: input.sourceDecisionId,
      mode: input.mode,
      policyVersion: input.policyVersion,
      producedDecisionId: input.producedDecisionId,
      createdAt: input.createdAt,
    };
  }

  findById(id: string): ReplayRecord | undefined {
    const row = this.db.prepare("SELECT * FROM replays WHERE id = ?").get(id) as
      | ReplayRecordRow
      | undefined;
    if (!row) return undefined;
    return {
      replayId: row.id,
      sourceDecisionId: row.source_decision_id,
      mode: row.mode as ReplayMode,
      policyVersion: row.policy_version,
      producedDecisionId: row.produced_decision_id,
      createdAt: row.created_at,
    };
  }

  listBySource(sourceDecisionId: string): ReplayRecord[] {
    const rows = this.db
      .prepare("SELECT * FROM replays WHERE source_decision_id = ? ORDER BY rowid")
      .all(sourceDecisionId) as ReplayRecordRow[];
    return rows.map((r) => ({
      replayId: r.id,
      sourceDecisionId: r.source_decision_id,
      mode: r.mode as ReplayMode,
      policyVersion: r.policy_version,
      producedDecisionId: r.produced_decision_id,
      createdAt: r.created_at,
    }));
  }

  saveDiff(replayId: string, sourceDecisionId: string, diff: DecisionDiff): void {
    this.db
      .prepare(
        `INSERT INTO decision_diffs (replay_id, source_decision_id, identical, sections_json)
         VALUES (?, ?, ?, ?)`
      )
      .run(replayId, sourceDecisionId, diff.identical ? 1 : 0, JSON.stringify(diff.sections));
  }

  findDiff(replayId: string): DecisionDiff | undefined {
    const row = this.db
      .prepare("SELECT * FROM decision_diffs WHERE replay_id = ?")
      .get(replayId) as
      | { source_decision_id: string; identical: number; sections_json: string }
      | undefined;
    if (!row) return undefined;
    return {
      replayId,
      sourceDecisionId: row.source_decision_id,
      identical: row.identical === 1,
      sections: parseJson<DecisionDiff["sections"]>(row.sections_json) ?? [],
    };
  }
}
