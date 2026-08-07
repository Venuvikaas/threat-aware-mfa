/**
 * Challenge persistence (docs/EXECUTION.md Phase 6 preparation, table created
 * in Phase 1). A challenge is a one-time, expiring credential bound to a
 * decision; consumption and expiry are enforced at the repository boundary.
 */
import type { Db } from "../db/connection.js";
import type { ChallengeMode, FactorId } from "@mfa/contracts";

export interface ChallengeRow {
  id: string;
  decisionId: string;
  factor: FactorId;
  mode: ChallengeMode;
  challengeData: unknown;
  expiresAt: string;
  consumedAt: string | null;
  verified: boolean;
  createdAt: string;
}

interface ChallengeRecord {
  id: string;
  decision_id: string;
  factor: string;
  mode: string;
  challenge_data_json: string | null;
  expires_at: string;
  consumed_at: string | null;
  verified: number;
  created_at: string;
}

function toChallenge(row: ChallengeRecord): ChallengeRow {
  return {
    id: row.id,
    decisionId: row.decision_id,
    factor: row.factor as FactorId,
    mode: row.mode as ChallengeMode,
    challengeData: row.challenge_data_json
      ? (JSON.parse(row.challenge_data_json) as unknown)
      : null,
    expiresAt: row.expires_at,
    consumedAt: row.consumed_at,
    verified: row.verified === 1,
    createdAt: row.created_at,
  };
}

export class ChallengeRepository {
  constructor(private readonly db: Db) {}

  create(input: ChallengeRow): ChallengeRow {
    this.db
      .prepare(
        `INSERT INTO challenges (id, decision_id, factor, mode, challenge_data_json, expires_at, consumed_at, verified, created_at)
         VALUES (@id, @decisionId, @factor, @mode, @challengeData, @expiresAt, @consumedAt, @verified, @createdAt)`
      )
      .run({
        ...input,
        challengeData: input.challengeData === undefined || input.challengeData === null
          ? null
          : JSON.stringify(input.challengeData),
        verified: input.verified ? 1 : 0,
      });
    return input;
  }

  findById(id: string): ChallengeRow | undefined {
    const row = this.db
      .prepare("SELECT * FROM challenges WHERE id = ?")
      .get(id) as ChallengeRecord | undefined;
    return row ? toChallenge(row) : undefined;
  }

  /** Atomically mark consumed + verified. Returns false when already consumed. */
  consume(id: string, verified: boolean, consumedAt: string): boolean {
    const result = this.db
      .prepare(
        `UPDATE challenges SET consumed_at = ?, verified = ? WHERE id = ? AND consumed_at IS NULL`
      )
      .run(consumedAt, verified ? 1 : 0, id);
    return result.changes === 1;
  }
}
