import type { Decision, Scenario } from "../engine/types";
import { EvidenceList } from "./EvidenceList";
import { ThreatSummary } from "./ThreatSummary";
import { FactorCard } from "./FactorCard";
import { OutcomeCard } from "./OutcomeCard";

interface ScenarioPanelProps {
  scenario: Scenario;
  decision: Decision;
}

export function ScenarioPanel({ scenario, decision }: ScenarioPanelProps) {
  return (
    <section className="scenario-panel" aria-label={scenario.title}>
      <header className="scenario-panel-head">
        <h2 className="scenario-panel-title">{scenario.title}</h2>
        <p className="scenario-panel-meta">
          ₹{scenario.transaction.amount.toLocaleString("en-IN")} · new payee ·{" "}
          {scenario.aggregateRisk} risk
        </p>
      </header>

      <div className="trace-step">
        <span className="trace-step-number">1</span>
        <div>
          <h3 className="trace-step-title">Observed evidence</h3>
          <EvidenceList evidence={decision.evidenceUsed} />
        </div>
      </div>

      <div className="trace-step">
        <span className="trace-step-number">2</span>
        <div>
          <h3 className="trace-step-title">Suspected threat</h3>
          <ThreatSummary decision={decision} />
        </div>
      </div>

      <div className="trace-step">
        <span className="trace-step-number">3</span>
        <div>
          <h3 className="trace-step-title">Factor evaluation</h3>
          <div className="factor-list">
            {decision.factors.map((factor) => (
              <FactorCard
                key={factor.factorId}
                factor={factor}
                selected={factor.factorId === decision.selectedFactor}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="trace-step">
        <span className="trace-step-number">4</span>
        <div>
          <h3 className="trace-step-title">Decision</h3>
          <OutcomeCard decision={decision} />
        </div>
      </div>
    </section>
  );
}
