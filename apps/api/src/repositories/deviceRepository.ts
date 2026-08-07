/**
 * Device persistence (EXECUTION_new2.md Phase 2).
 *
 * A device is keyed by its client-supplied id; known devices refresh only
 * their last-seen time. First-seen state drives the FIRST_SEEN_DEVICE
 * evidence, which feeds the DEVICE_INTEGRITY_CONCERN hypothesis.
 */
import type { Db } from "../db/connection.js";

export interface DeviceRow {
  id: string;
  userId: string;
  trusted: boolean;
  firstSeenAt: string;
  lastSeenAt: string;
}

interface DeviceRecord {
  id: string;
  user_id: string;
  trusted: number;
  first_seen_at: string;
  last_seen_at: string;
}

function toDevice(row: DeviceRecord): DeviceRow {
  return {
    id: row.id,
    userId: row.user_id,
    trusted: row.trusted === 1,
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at,
  };
}

export class DeviceRepository {
  constructor(private readonly db: Db) {}

  findById(id: string): DeviceRow | undefined {
    const row = this.db.prepare("SELECT * FROM devices WHERE id = ?").get(id) as
      | DeviceRecord
      | undefined;
    return row ? toDevice(row) : undefined;
  }

  findByUserId(userId: string): DeviceRow[] {
    const rows = this.db
      .prepare("SELECT * FROM devices WHERE user_id = ? ORDER BY id")
      .all(userId) as DeviceRecord[];
    return rows.map(toDevice);
  }

  /** Insert if missing; otherwise refresh only the last-seen time. */
  upsert(input: DeviceRow): DeviceRow {
    const existing = this.findById(input.id);
    if (!existing) return this.create(input);
    this.db.prepare("UPDATE devices SET last_seen_at = ? WHERE id = ?").run(input.lastSeenAt, input.id);
    return { ...existing, lastSeenAt: input.lastSeenAt };
  }

  private create(input: DeviceRow): DeviceRow {
    this.db
      .prepare(
        `INSERT INTO devices (id, user_id, trusted, first_seen_at, last_seen_at)
         VALUES (@id, @userId, @trusted, @firstSeenAt, @lastSeenAt)`
      )
      .run({ ...input, trusted: input.trusted ? 1 : 0 });
    return input;
  }
}
