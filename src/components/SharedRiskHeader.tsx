import type { Scenario } from "../engine/types";

interface SharedRiskHeaderProps {
  scenarios: Scenario[];
}

export function SharedRiskHeader({ scenarios }: SharedRiskHeaderProps) {
  const first = scenarios[0];

  return (
    <section className="shared-risk" aria-label="Shared scalar risk">
      <div className="shared-risk-anchor">
        <span className="same-risk-badge">SAME RISK</span>
        <div>
          <p className="shared-risk-label">
            Equal aggregate risk · equal assurance requirement
          </p>
          <p className="shared-risk-question">
            Should these payments receive the same authentication challenge?
          </p>
        </div>
      </div>
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
    </section>
  );
}
