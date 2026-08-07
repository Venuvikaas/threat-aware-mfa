import type { Decision, Scenario } from "../engine/types";
import { DecisionTrace } from "./DecisionTrace";

interface ScenarioPanelProps {
  scenario: Scenario;
  decision: Decision;
  control?: React.ReactNode;
}

export function ScenarioPanel({
  scenario,
  decision,
  control,
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
        {control}
      </header>
      <DecisionTrace decision={decision} />
    </section>
  );
}
