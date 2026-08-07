/**
 * User persistence (EXECUTION_new2.md Phase 2).
 *
 * Capability state lives in `user_capabilities` (seeded from demo-data), not
 * on the users row — the capability gate is separate from identity.
 */
import type { Db } from "../db/connection.js";

export interface UserRow {
  id: string;
  name: string;
  accountCreatedAt: string;
  createdAt: string;
}

interface UserRecord {
  id: string;
  name: string;
  account_created_at: string;
  created_at: string;
}

function toUser(row: UserRecord): UserRow {
  return {
    id: row.id,
    name: row.name,
    accountCreatedAt: row.account_created_at,
    createdAt: row.created_at,
  };
}

export class UserRepository {
  constructor(private readonly db: Db) {}

  findById(id: string): UserRow | undefined {
    const row = this.db.prepare("SELECT * FROM users WHERE id = ?").get(id) as
      | UserRecord
      | undefined;
    return row ? toUser(row) : undefined;
  }

  all(): UserRow[] {
    const rows = this.db.prepare("SELECT * FROM users ORDER BY id").all() as UserRecord[];
    return rows.map(toUser);
  }
}
