/**
 * Persisted audit timeline (docs/EXECUTION.md Phase 5/9).
 *
 * Rendered from GET /api/v1/decisions/:id/audit — the append-only server
 * record, oldest first.
 */
import type { AuditEvent } from "@mfa/contracts";

const ICON: Record<AuditEvent["eventType"], string> = {
  DECISION_CREATED: "◎",
  FACTOR_BLOCKED: "⊘",
  FACTOR_SELECTED: "→",
  CHALLENGE_CREATED: "⚿",
  CHALLENGE_VERIFIED: "✓",
  RECOVERY_REQUIRED: "!",
};

const KIND: Record<AuditEvent["eventType"], string> = {
  DECISION_CREATED: "created",
  FACTOR_BLOCKED: "blocked",
  FACTOR_SELECTED: "selected",
  CHALLENGE_CREATED: "challenge",
  CHALLENGE_VERIFIED: "verified",
  RECOVERY_REQUIRED: "recovery",
};

export function AuditTimeline({ events }: { events: AuditEvent[] }) {
  return (
    <section className="panel-section">
      <div className="section-title">
        Audit timeline <span className="chip chip-muted">persisted</span>
      </div>
      <ol className="timeline">
        {events.map((e) => (
          <li key={e.id} className={`timeline-item kind-${KIND[e.eventType]}`}>
            <span className="timeline-icon">{ICON[e.eventType]}</span>
            <div className="timeline-body">
              <div className="timeline-head">
                <span className="timeline-type">{e.eventType}</span>
                <code className="timeline-reason">{e.reasonCode}</code>
                <span className="timeline-time">{e.createdAt}</span>
              </div>
              {Object.keys(e.details).length > 0 ? (
                <code className="timeline-details">{JSON.stringify(e.details)}</code>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
