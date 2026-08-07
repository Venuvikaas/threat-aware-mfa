/**
 * Transaction persistence. The client transaction ID is unique so a repeated
 * request cannot silently create a conflicting decision (docs/EXECUTION.md
 * PART 3 idempotency rule).
 */
import type { Db } from "../db/connection.js";
import { parseJson } from "../lib/ids.js";

export type TransactionStatus = "PENDING" | "AUTHORIZED" | "DENIED" | "PENDING_RECOVERY";

export interface TransactionRow {
  id: string;
  clientTransactionId: string;
  userId: string;
  amountMinor: number;
  currency: "INR";
  payeeId: string;
  payeeIsKnown: boolean;
  status: TransactionStatus;
  createdAt: string;
}

interface TransactionRecord {
  id: string;
  client_transaction_id: string;
  user_id: string;
  amount_minor: number;
  currency: string;
  payee_id: string;
  payee_is_known: number;
  status: string;
  created_at: string;
}

function toTransaction(row: TransactionRecord): TransactionRow {
  return {
    id: row.id,
    clientTransactionId: row.client_transaction_id,
    userId: row.user_id,
    amountMinor: row.amount_minor,
    currency: "INR",
    payeeId: row.payee_id,
    payeeIsKnown: row.payee_is_known === 1,
    status: row.status as TransactionStatus,
    createdAt: row.created_at,
  };
}

export class TransactionRepository {
  constructor(private readonly db: Db) {}

  findByClientTransactionId(clientTransactionId: string): TransactionRow | undefined {
    const row = this.db
      .prepare("SELECT * FROM transactions WHERE client_transaction_id = ?")
      .get(clientTransactionId) as TransactionRecord | undefined;
    return row ? toTransaction(row) : undefined;
  }

  findById(id: string): TransactionRow | undefined {
    const row = this.db
      .prepare("SELECT * FROM transactions WHERE id = ?")
      .get(id) as TransactionRecord | undefined;
    return row ? toTransaction(row) : undefined;
  }

  create(input: TransactionRow): TransactionRow {
    this.db
      .prepare(
        `INSERT INTO transactions (id, client_transaction_id, user_id, amount_minor, currency,
           payee_id, payee_is_known, status, created_at)
         VALUES (@id, @clientTransactionId, @userId, @amountMinor, @currency,
           @payeeId, @payeeIsKnown, @status, @createdAt)`
      )
      .run({
        ...input,
        payeeIsKnown: input.payeeIsKnown ? 1 : 0,
      });
    return input;
  }

  updateStatus(id: string, status: TransactionStatus): void {
    this.db.prepare("UPDATE transactions SET status = ? WHERE id = ?").run(status, id);
  }
}

/** Normalized signal record persisted next to a transaction. */
export interface SignalRow {
  name: string;
  value: boolean | number | null;
  source: string;
  synthetic: boolean;
  observedAt: string;
}

export class SignalRepository {
  constructor(private readonly db: Db) {}

  insertMany(transactionId: string, signals: SignalRow[]): void {
    const stmt = this.db.prepare(
      `INSERT INTO signals (transaction_id, name, value_json, source, synthetic, observed_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    );
    for (const s of signals) {
      stmt.run(
        transactionId,
        s.name,
        JSON.stringify(s.value),
        s.source,
        s.synthetic ? 1 : 0,
        s.observedAt
      );
    }
  }

  findByTransactionId(transactionId: string): SignalRow[] {
    const rows = this.db
      .prepare("SELECT * FROM signals WHERE transaction_id = ? ORDER BY id")
      .all(transactionId) as {
      name: string;
      value_json: string;
      source: string;
      synthetic: number;
      observed_at: string;
    }[];
    return rows.map((r) => ({
      name: r.name,
      value: parseJson<boolean | number | null>(r.value_json) ?? null,
      source: r.source,
      synthetic: r.synthetic === 1,
      observedAt: r.observed_at,
    }));
  }
}
