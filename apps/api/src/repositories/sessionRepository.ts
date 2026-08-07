/**
 * Session persistence. Sessions are keyed by their client-supplied session ID.
 */
import type { Db } from "../db/connection.js";

export interface SessionRow {
  id: string;
  userId: string;
  deviceId: string | null;
  ipAddress: string;
  asn: string;
  country: string;
  startedAt: string;
  failedLoginCount: number;
}

interface SessionRecord {
  id: string;
  user_id: string;
  device_id: string | null;
  ip_address: string;
  asn: string;
  country: string;
  started_at: string;
  failed_login_count: number;
}

function toSession(row: SessionRecord): SessionRow {
  return {
    id: row.id,
    userId: row.user_id,
    deviceId: row.device_id,
    ipAddress: row.ip_address,
    asn: row.asn,
    country: row.country,
    startedAt: row.started_at,
    failedLoginCount: row.failed_login_count,
  };
}

export class SessionRepository {
  constructor(private readonly db: Db) {}

  findById(id: string): SessionRow | undefined {
    const row = this.db
      .prepare("SELECT * FROM sessions WHERE id = ?")
      .get(id) as SessionRecord | undefined;
    return row ? toSession(row) : undefined;
  }

  upsert(input: SessionRow): SessionRow {
    const existing = this.findById(input.id);
    if (existing) {
      this.db
        .prepare(
          `UPDATE sessions SET failed_login_count = ?, started_at = ?, ip_address = ?,
             asn = ?, country = ?, device_id = ? WHERE id = ?`
        )
        .run(
          input.failedLoginCount,
          input.startedAt,
          input.ipAddress,
          input.asn,
          input.country,
          input.deviceId,
          input.id
        );
      return { ...existing, ...input };
    }
    this.db
      .prepare(
        `INSERT INTO sessions (id, user_id, device_id, ip_address, asn, country, started_at, failed_login_count)
         VALUES (@id, @userId, @deviceId, @ipAddress, @asn, @country, @startedAt, @failedLoginCount)`
      )
      .run(input);
    return input;
  }
}
