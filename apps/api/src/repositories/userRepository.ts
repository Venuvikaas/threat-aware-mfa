/**
 * User persistence (docs/EXECUTION.md Phase 1).
 */
import type { Db } from "../db/connection.js";

export interface UserRow {
  id: string;
  name: string;
  accountCreatedAt: string;
  passkeyEnrolled: boolean;
  createdAt: string;
}

interface UserRecord {
  id: string;
  name: string;
  account_created_at: string;
  passkey_enrolled: number;
  created_at: string;
}

function toUser(row: UserRecord): UserRow {
  return {
    id: row.id,
    name: row.name,
    accountCreatedAt: row.account_created_at,
    passkeyEnrolled: row.passkey_enrolled === 1,
    createdAt: row.created_at,
  };
}

export class UserRepository {
  constructor(private readonly db: Db) {}

  findById(id: string): UserRow | undefined {
    const row = this.db
      .prepare("SELECT * FROM users WHERE id = ?")
      .get(id) as UserRecord | undefined;
    return row ? toUser(row) : undefined;
  }

  all(): UserRow[] {
    const rows = this.db
      .prepare("SELECT * FROM users ORDER BY id")
      .all() as UserRecord[];
    return rows.map(toUser);
  }

  create(input: UserRow): UserRow {
    this.db
      .prepare(
        `INSERT INTO users (id, name, account_created_at, passkey_enrolled, created_at)
         VALUES (@id, @name, @accountCreatedAt, @passkeyEnrolled, @createdAt)`
      )
      .run({
        ...input,
        passkeyEnrolled: input.passkeyEnrolled ? 1 : 0,
      });
    return input;
  }

  setPasskeyEnrolled(id: string, enrolled: boolean): void {
    this.db
      .prepare("UPDATE users SET passkey_enrolled = ? WHERE id = ?")
      .run(enrolled ? 1 : 0, id);
  }
}
