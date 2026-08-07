/**
 * Device persistence. Devices are keyed by their client-supplied device ID;
 * a known device is updated with the latest seen time, an unknown device is
 * created as a synthetic demo entity.
 */
import type { Db } from "../db/connection.js";

export interface DeviceRow {
  id: string;
  userId: string;
  trusted: boolean;
  browserFingerprint: string;
  firstSeenAt: string;
  lastSeenAt: string;
}

interface DeviceRecord {
  id: string;
  user_id: string;
  trusted: number;
  browser_fingerprint: string;
  first_seen_at: string;
  last_seen_at: string;
}

function toDevice(row: DeviceRecord): DeviceRow {
  return {
    id: row.id,
    userId: row.user_id,
    trusted: row.trusted === 1,
    browserFingerprint: row.browser_fingerprint,
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at,
  };
}

export class DeviceRepository {
  constructor(private readonly db: Db) {}

  findById(id: string): DeviceRow | undefined {
    const row = this.db
      .prepare("SELECT * FROM devices WHERE id = ?")
      .get(id) as DeviceRecord | undefined;
    return row ? toDevice(row) : undefined;
  }

  create(input: DeviceRow): DeviceRow {
    this.db
      .prepare(
        `INSERT INTO devices (id, user_id, trusted, browser_fingerprint, first_seen_at, last_seen_at)
         VALUES (@id, @userId, @trusted, @browserFingerprint, @firstSeenAt, @lastSeenAt)`
      )
      .run({
        ...input,
        trusted: input.trusted ? 1 : 0,
      });
    return input;
  }

  /** Insert if missing; otherwise refresh the seen times. */
  upsert(input: DeviceRow): DeviceRow {
    const existing = this.findById(input.id);
    if (!existing) return this.create(input);
    this.db
      .prepare(
        `UPDATE devices SET last_seen_at = ?, first_seen_at = ? WHERE id = ?`
      )
      .run(input.lastSeenAt, input.firstSeenAt, input.id);
    return { ...existing, lastSeenAt: input.lastSeenAt, firstSeenAt: input.firstSeenAt };
  }
}
