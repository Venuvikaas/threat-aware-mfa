/**
 * Causality Trace view (EXECUTION_new2.md §4.8, Phase 5).
 *
 * Renders the structured rule trace grouped by phase — the audit trail of
 * WHY the decision happened, not just what it was. Every event cites its
 * input and output references, so the presenter can narrate the chain:
 * evidence → threat → trust → eligibility → selection → outcome.
 */
import { useMemo, useState } from "react";
import type { RuleTraceEvent, TracePhase } from "@mfa/contracts";

const PHASE_ORDER: TracePhase[] = [
  "EVIDENCE_NORMALIZATION",
  "THREAT_ASSESSMENT",
  "TRUST_ASSESSMENT",
  "FACTOR_ELIGIBILITY",
  "SELECTION",
  "CHALLENGE",
  "OUTCOME",
];

const PHASE_LABEL: Record<TracePhase, string> = {
  EVIDENCE_NORMALIZATION: "Evidence normalization",
  THREAT_ASSESSMENT: "Threat assessment",
  TRUST_ASSESSMENT: "Trust assessment",
  FACTOR_ELIGIBILITY: "Factor eligibility",
  SELECTION: "Selection",
  CHALLENGE: "Challenge",
  OUTCOME: "Outcome",
};

const PHASE_ICON: Record<TracePhase, string> = {
  EVIDENCE_NORMALIZATION: "◎",
  THREAT_ASSESSMENT: "◬",
  TRUST_ASSESSMENT: "◆",
  FACTOR_ELIGIBILITY: "◧",
  SELECTION: "→",
  CHALLENGE: "⚿",
  OUTCOME: "✓",
};

export function CausalityTrace({ events }: { events: RuleTraceEvent[] }) {
  const [filter, setFilter] = useState<TracePhase | "ALL">("ALL");

  const grouped = useMemo(() => {
    const map = new Map<TracePhase, RuleTraceEvent[]>();
    for (const phase of PHASE_ORDER) map.set(phase, []);
    for (const e of [...events].sort((a, b) => a.sequence - b.sequence)) {
      map.get(e.phase)?.push(e);
    }
    return map;
  }, [events]);

  const phases = PHASE_ORDER.filter((p) => grouped.get(p)!.length > 0);

  return (
    <section className="panel-section trace-section">
      <div className="section-head-row">
        <div className="section-title">
          Causality trace{" "}
          <span className="chip chip-muted">
            {events.length} rule{events.length === 1 ? "" : "s"}
          </span>
        </div>
        <select
          className="trace-filter"
          value={filter}
          onChange={(e) => setFilter(e.target.value as TracePhase | "ALL")}
          aria-label="Filter trace by phase"
        >
          <option value="ALL">All phases</option>
          {PHASE_ORDER.filter((p) => grouped.get(p)!.length > 0).map((p) => (
            <option key={p} value={p}>
              {PHASE_LABEL[p]}
            </option>
          ))}
        </select>
      </div>

      {phases.length === 0 ? (
        <p className="muted">No trace events recorded.</p>
      ) : (
        <ol className="trace-list">
          {phases
            .filter((p) => filter === "ALL" || filter === p)
            .map((phase) => (
              <li key={phase} className="trace-phase">
                <div className="trace-phase-head">
                  <span className="trace-phase-icon">{PHASE_ICON[phase]}</span>
                  <span className="trace-phase-label">{PHASE_LABEL[phase]}</span>
                  <span className="trace-phase-count">
                    {grouped.get(phase)!.length}
                  </span>
                </div>
                <ol className="trace-events">
                  {grouped.get(phase)!.map((e) => (
                    <li key={e.id} className="trace-event">
                      <span className="trace-seq">{String(e.sequence).padStart(2, "0")}</span>
                      <div className="trace-event-body">
                        <div className="trace-event-head">
                          <code className="trace-rule">{e.ruleId}</code>
                          <code className="trace-code">{e.explanationCode}</code>
                        </div>
                        {e.inputRefs.length > 0 ? (
                          <div className="trace-refs">
                            <span className="trace-ref-label">in</span>
                            {e.inputRefs.map((r) => (
                              <code key={r} className="trace-ref">{r}</code>
                            ))}
                          </div>
                        ) : null}
                        {e.outputRefs.length > 0 ? (
                          <div className="trace-refs">
                            <span className="trace-ref-label">out</span>
                            {e.outputRefs.map((r) => (
                              <code key={r} className="trace-ref out">{r}</code>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ol>
              </li>
            ))}
        </ol>
      )}
    </section>
  );
}
