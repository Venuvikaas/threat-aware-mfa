import type { Decision } from "../engine/types";
import { EvidenceList } from "./EvidenceList";
import { ThreatSummary } from "./ThreatSummary";
import { FactorCard } from "./FactorCard";
import { OutcomeCard } from "./OutcomeCard";

interface DecisionTraceProps {
  decision: Decision;
}

const STAGES = ["Observed", "Suspected", "Do not trust", "Excluded", "Decision"] as const;

export function DecisionTrace({ decision }: DecisionTraceProps) {
  const nonEligible = decision.factors.filter((f) => f.state !== "eligible");
  const eligible = decision.factors.filter((f) => f.state === "eligible");

  return (
    <div className="decision-trace">
      <div className="trace-step">
        <span className="trace-step-number">1</span>
        <div>
          <h3 className="trace-step-title">{STAGES[0]}</h3>
          <EvidenceList evidence={decision.evidenceUsed} />
        </div>
      </div>

      <div className="trace-step">
        <span className="trace-step-number">2</span>
        <div>
          <h3 className="trace-step-title">{STAGES[1]}</h3>
          <ThreatSummary decision={decision} />
        </div>
      </div>

      <div className="trace-step">
        <span className="trace-step-number">3</span>
        <div>
          <h3 className="trace-step-title">{STAGES[2]}</h3>
          {decision.doNotTrust.length > 0 ? (
            <ul className="distrust-list">
              {decision.doNotTrust.map((item) => (
                <li key={item} className="distrust-item">
                  {item}
                </li>
              ))}
            </ul>
          ) : (
            <p className="evidence-empty">Nothing placed under suspicion.</p>
          )}
        </div>
      </div>

      <div className="trace-step">
        <span className="trace-step-number">4</span>
        <div>
          <h3 className="trace-step-title">{STAGES[3]}</h3>
          <div className="factor-list">
            {nonEligible.map((factor) => (
              <FactorCard key={factor.factorId} factor={factor} selected={false} />
            ))}
            {eligible.length > 0 && (
              <div className="trace-step-eligible">
                <p className="trace-step-eligible-label">Still eligible</p>
                {eligible.map((factor) => (
                  <FactorCard
                    key={factor.factorId}
                    factor={factor}
                    selected={factor.factorId === decision.selectedFactor}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="trace-step">
        <span className="trace-step-number">5</span>
        <div>
          <h3 className="trace-step-title">{STAGES[4]}</h3>
          <OutcomeCard decision={decision} />
        </div>
      </div>
    </div>
  );
}
