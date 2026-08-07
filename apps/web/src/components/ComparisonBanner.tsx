/**
 * Same-risk comparison anchor (docs/EXECUTION.md Phase 9).
 *
 * When both hero decisions exist, the banner makes the shared scalar risk and
 * the differing threat-aware reasons the first visual anchors.
 */
import type { DecisionRecord } from "../types";

export function ComparisonBanner({ left, right }: { left: DecisionRecord; right: DecisionRecord }) {
  const sameRisk = left.decision.risk.level === right.decision.risk.level;
  const sameBaseline =
    left.baseline?.requirement === right.baseline?.requirement;

  return (
    <section className="comparison-banner">
      <div className="comparison-head">
        <span className="comparison-kicker">Hero comparison</span>
        <h2 className="comparison-title">
          SAME RISK{sameRisk ? ` — ${left.decision.risk.level}` : ""}
          {sameBaseline ? ` · same scalar baseline` : ""}
        </h2>
        <p className="comparison-sub">
          Both transactions reached the same risk level and the same
          severity-only requirement. The threat-aware policy still reaches
          different factor decisions — because it distrusts different channels.
        </p>
      </div>
      <div className="comparison-grid">
        <div className="comparison-col">
          <span className="comparison-col-label">{left.decision.threat.type}</span>
          <span className="comparison-col-value">
            blocks {left.decision.blockedFactors.join(", ") || "—"}
          </span>
        </div>
        <div className="comparison-vs">vs</div>
        <div className="comparison-col">
          <span className="comparison-col-label">{right.decision.threat.type}</span>
          <span className="comparison-col-value">
            blocks {right.decision.blockedFactors.join(", ") || "—"}
          </span>
        </div>
      </div>
    </section>
  );
}
