/**
 * Audit event persistence. The audit log is append-only through application
 * code (docs/EXECUTION.md PART 4 database rule). Ordering uses SQLite rowid
 * because audit IDs are server-generated random strings; rowid preserves
 * exact insertion order.
 */
import type { Db } from "../db/connection.js";
import { newId } from "../lib/ids.js";
import type { AuditEvent, AuditEventType } from "@mfa/contracts";

export interface AuditInput {
  decisionId: string;
  eventType: AuditEventType;
  reasonCode: string;
  details: Record<string, unknown>;
  createdAt: string;
}

export class AuditRepository {
  constructor(private readonly db: Db) {}

  insert(input: AuditInput): AuditEvent {
    const event: AuditEvent = {
      id: newId("aud"),
      ...input,
    };
    this.db
      .prepare(
        `INSERT INTO audit_events (id, decision_id, event_type, reason_code, details_json, created_at)
         VALUES (@id, @decisionId, @eventType, @reasonCode, @details, @createdAt)`
      )
      .run({
        ...event,
        details: JSON.stringify(event.details),
      });
    return event;
  }

  /** Insertion order, oldest first (docs/EXECUTION.md PART 3 audit contract). */
  listByDecision(decisionId: string): AuditEvent[] {
    const rows = this.db
      .prepare("SELECT * FROM audit_events WHERE decision_id = ? ORDER BY rowid")
      .all(decisionId) as {
      id: string;
      decision_id: string;
      event_type: string;
      reason_code: string;
      details_json: string;
      created_at: string;
    }[];
    return rows.map((r) => ({
      id: r.id,
      decisionId: r.decision_id,
      eventType: r.event_type as AuditEventType,
      reasonCode: r.reason_code,
      details: parseJson<Record<string, unknown>>(r.details_json) ?? {},
      createdAt: r.created_at,
    }));
  }
}

function parseJson<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}
