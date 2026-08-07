import type { Scenario } from "../engine/types";

interface SharedRiskHeaderProps {
  scenarios: Scenario[];
}

export function SharedRiskHeader({ scenarios }: SharedRiskHeaderProps) {
  const first = scenarios[0];

  return (
    <section className="shared-risk" aria-label="Shared scalar risk">
      <p className="shared-risk-label">Same aggregate risk · same assurance requirement</p>
      <div className="shared-risk-values">
        <div className="shared-risk-value">
          <span className="shared-risk-key">Aggregate risk</span>
          <span className="shared-risk-badge risk-badge">
            {first.aggregateRisk.toUpperCase()}
          </span>
        </div>
        <div className="shared-risk-value">
          <span className="shared-risk-key">Required assurance</span>
          <span className="shared-risk-badge assurance-badge">
            {first.requiredAssurance}+
          </span>
        </div>
        <div className="shared-risk-value">
          <span className="shared-risk-key">Transaction</span>
          <span className="shared-risk-badge tx-badge">
            ₹{first.transaction.amount.toLocaleString("en-IN")} · new payee
          </span>
        </div>
      </div>
      <p className="shared-risk-question">
        Equal risk — should the authentication decision be equal?
      </p>
    </section>
  );
}
