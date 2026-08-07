/**
 * Transaction persistence (EXECUTION_new2.md Phase 2).
 *
 * The client transaction ID is unique so a repeated request cannot silently
 * create a conflicting decision (idempotency). Raw signal rows are replaced
 * by evidence items bound to the decision.
 */
import type { Db } from "../db/connection.js";

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
    const row = this.db.prepare("SELECT * FROM transactions WHERE id = ?").get(id) as
      | TransactionRecord
      | undefined;
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
      .run({ ...input, payeeIsKnown: input.payeeIsKnown ? 1 : 0 });
    return input;
  }

  updateStatus(id: string, status: TransactionStatus): void {
    this.db.prepare("UPDATE transactions SET status = ? WHERE id = ?").run(status, id);
  }
}
