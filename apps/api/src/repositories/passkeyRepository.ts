/**
 * Passkey persistence (docs/EXECUTION_new.md Phase 7).
 *
 * - `passkey_credentials` stores PUBLIC credential data only: base64url
 *   credential id + COSE public key, signature counter, and transports.
 *   Private keys never exist here (database rule: no passkey private keys).
 * - `passkey_registrations` stores the one-time server challenge state for a
 *   pending registration ceremony, consumed exactly once before expiry.
 */
import type { Db } from "../db/connection.js";

export type PasskeyDeviceType = "singleDevice" | "multiDevice";

export interface PasskeyCredentialRow {
  id: string;
  userId: string;
  /** base64url-encoded COSE public key (public data only). */
  publicKey: string;
  counter: number;
  transports: string[];
  deviceType: PasskeyDeviceType | null;
  backedUp: boolean;
  createdAt: string;
}

interface CredentialRecord {
  id: string;
  user_id: string;
  public_key: string;
  counter: number;
  transports: string;
  device_type: string | null;
  backed_up: number;
  created_at: string;
}

export interface PasskeyRegistrationRow {
  id: string;
  userId: string;
  challenge: string;
  expectedOrigin: string;
  rpId: string;
  expiresAt: string;
  consumedAt: string | null;
  createdAt: string;
}

interface RegistrationRecord {
  id: string;
  user_id: string;
  challenge: string;
  expected_origin: string;
  rp_id: string;
  expires_at: string;
  consumed_at: string | null;
  created_at: string;
}

function toCredential(row: CredentialRecord): PasskeyCredentialRow {
  return {
    id: row.id,
    userId: row.user_id,
    publicKey: row.public_key,
    counter: row.counter,
    transports: JSON.parse(row.transports) as string[],
    deviceType: (row.device_type ?? null) as PasskeyDeviceType | null,
    backedUp: row.backed_up === 1,
    createdAt: row.created_at,
  };
}

function toRegistration(row: RegistrationRecord): PasskeyRegistrationRow {
  return {
    id: row.id,
    userId: row.user_id,
    challenge: row.challenge,
    expectedOrigin: row.expected_origin,
    rpId: row.rp_id,
    expiresAt: row.expires_at,
    consumedAt: row.consumed_at,
    createdAt: row.created_at,
  };
}

export class PasskeyCredentialRepository {
  constructor(private readonly db: Db) {}

  create(input: PasskeyCredentialRow): PasskeyCredentialRow {
    this.db
      .prepare(
        `INSERT INTO passkey_credentials (id, user_id, public_key, counter, transports,
           device_type, backed_up, created_at)
         VALUES (@id, @userId, @publicKey, @counter, @transports,
           @deviceType, @backedUp, @createdAt)`
      )
      .run({
        ...input,
        transports: JSON.stringify(input.transports),
        deviceType: input.deviceType ?? null,
        backedUp: input.backedUp ? 1 : 0,
      });
    return input;
  }

  findByUserId(userId: string): PasskeyCredentialRow[] {
    const rows = this.db
      .prepare("SELECT * FROM passkey_credentials WHERE user_id = ? ORDER BY created_at")
      .all(userId) as CredentialRecord[];
    return rows.map(toCredential);
  }

  findById(id: string): PasskeyCredentialRow | undefined {
    const row = this.db
      .prepare("SELECT * FROM passkey_credentials WHERE id = ?")
      .get(id) as CredentialRecord | undefined;
    return row ? toCredential(row) : undefined;
  }

  findByIdAndUser(id: string, userId: string): PasskeyCredentialRow | undefined {
    const row = this.db
      .prepare("SELECT * FROM passkey_credentials WHERE id = ? AND user_id = ?")
      .get(id, userId) as CredentialRecord | undefined;
    return row ? toCredential(row) : undefined;
  }

  updateCounter(id: string, counter: number): void {
    this.db
      .prepare("UPDATE passkey_credentials SET counter = ? WHERE id = ?")
      .run(counter, id);
  }

  removeByUserId(userId: string): void {
    this.db.prepare("DELETE FROM passkey_credentials WHERE user_id = ?").run(userId);
  }
}

export class PasskeyRegistrationRepository {
  constructor(private readonly db: Db) {}

  create(input: PasskeyRegistrationRow): PasskeyRegistrationRow {
    this.db
      .prepare(
        `INSERT INTO passkey_registrations (id, user_id, challenge, expected_origin, rp_id,
           expires_at, consumed_at, created_at)
         VALUES (@id, @userId, @challenge, @expectedOrigin, @rpId,
           @expiresAt, @consumedAt, @createdAt)`
      )
      .run(input);
    return input;
  }

  findById(id: string): PasskeyRegistrationRow | undefined {
    const row = this.db
      .prepare("SELECT * FROM passkey_registrations WHERE id = ?")
      .get(id) as RegistrationRecord | undefined;
    return row ? toRegistration(row) : undefined;
  }

  /** Atomically mark consumed; returns false when already consumed. */
  consume(id: string, consumedAt: string): boolean {
    const result = this.db
      .prepare(
        `UPDATE passkey_registrations SET consumed_at = ?
         WHERE id = ? AND consumed_at IS NULL`
      )
      .run(consumedAt, id);
    return result.changes === 1;
  }
}
