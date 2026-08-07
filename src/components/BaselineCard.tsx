import type { ScalarBaselineResult } from "../engine/scalarBaseline";

interface BaselineCardProps {
  baseline: ScalarBaselineResult;
}

export function BaselineCard({ baseline }: BaselineCardProps) {
  return (
    <section className="baseline-card" aria-label="Scalar baseline result">
      <p className="baseline-card-label">Severity-only baseline</p>
      <p className="baseline-card-value">{baseline.requirement}</p>
      <p className="baseline-card-note">
        Receives only aggregate risk and required assurance — no threat
        indicators.
      </p>
    </section>
  );
}
