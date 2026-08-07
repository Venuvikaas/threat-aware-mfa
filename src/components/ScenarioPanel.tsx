import type { ReactNode } from "react";
import type { Decision, Scenario } from "../engine/types";
import { DecisionTrace } from "./DecisionTrace";

interface ScenarioPanelProps {
  scenario: Scenario;
  decision: Decision;
  control?: ReactNode;
  exportButton?: ReactNode;
}

export function ScenarioPanel({
  scenario,
  decision,
  control,
  exportButton,
}: ScenarioPanelProps) {
  return (
    <section className="scenario-panel" aria-label={scenario.title}>
      <header className="scenario-panel-head">
        <div>
          <h2 className="scenario-panel-title">{scenario.title}</h2>
          <p className="scenario-panel-meta">
            ₹{scenario.transaction.amount.toLocaleString("en-IN")} ·{" "}
            {scenario.transaction.payeeType} payee · {scenario.aggregateRisk}{" "}
            risk
          </p>
        </div>
        <div className="scenario-panel-actions">
          {control}
          {exportButton}
        </div>
      </header>
      <DecisionTrace decision={decision} />
    </section>
  );
}
