/**
 * Factor Inspector view (EXECUTION_new2.md §4.4–4.6, Phase 5).
 *
 * Renders the evaluated factor catalog exactly as the backend returned it:
 * ELIGIBLE / INELIGIBLE / UNAVAILABLE, with every failed requirement spelled
 * out (kind, requirement id, actual vs required state, and the reason code).
 * No factor logic lives in the browser.
 */
import type { FactorEvaluation, FailedRequirement } from "@mfa/contracts";

const STATUS_META: Record<
  FactorEvaluation["status"],
  { label: string; cls: string; icon: string }
> = {
  ELIGIBLE: { label: "Eligible", cls: "ok", icon: "✓" },
  INELIGIBLE: { label: "Ineligible", cls: "no", icon: "⊘" },
  UNAVAILABLE: { label: "Unavailable", cls: "off", icon: "∅" },
};

const KIND_LABEL: Record<FailedRequirement["kind"], string> = {
  TRUST: "trust requirement",
  CAPABILITY: "capability",
  ASSURANCE: "assurance",
};

export function FactorInspector({
  factors,
  onInspect,
}: {
  factors: FactorEvaluation[];
  onInspect?: (factor: FactorEvaluation) => void;
}) {
  return (
    <section className="panel-section factor-section">
      <div className="section-title">Factor inspector</div>
      <div className="factor-cards">
        {factors.map((f) => {
          const meta = STATUS_META[f.status];
          return (
            <div
              key={f.factorId}
              className={`factor-card factor-${f.status.toLowerCase()}`}
              onClick={onInspect ? () => onInspect(f) : undefined}
              role={onInspect ? "button" : undefined}
              tabIndex={onInspect ? 0 : undefined}
            >
              <div className="factor-top">
                <span className="factor-name">{f.factorId}</span>
                <span className={`factor-status status-${meta.cls}`}>
                  <span className="factor-status-icon">{meta.icon}</span>
                  {meta.label}
                </span>
              </div>
              <div className="factor-meta">
                <span className="chip">AAL{f.assuranceSatisfied ? " ok" : " below"} · friction {f.frictionTier}</span>
              </div>
              {f.failedRequirements.length > 0 ? (
                <ul className="failed-reqs">
                  {f.failedRequirements.map((r) => (
                    <li key={r.requirementId} className="failed-req">
                      <span className={`failed-req-kind kind-${r.kind.toLowerCase()}`}>
                        {KIND_LABEL[r.kind]}
                      </span>
                      <code className="failed-req-reason">{r.reasonCode}</code>
                      <span className="failed-req-states">
                        {r.requiredState} → <strong>{r.actualState}</strong>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
