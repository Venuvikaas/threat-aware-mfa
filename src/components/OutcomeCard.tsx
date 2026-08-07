import type { Decision } from "../engine/types";

interface OutcomeCardProps {
  decision: Decision;
}

export function OutcomeCard({ decision }: OutcomeCardProps) {
  const isRecovery = decision.outcome === "assisted_recovery";

  return (
    <section
      className={`outcome-card ${isRecovery ? "outcome-recovery" : "outcome-selected"}`}
      aria-label="Decision outcome"
    >
      <p className="outcome-card-label">
        {isRecovery ? "Policy outcome" : "Selected factor"}
      </p>
      <p className="outcome-card-message">{decision.outcomeMessage}</p>
      <p className="outcome-card-simulated">Authentication execution simulated</p>
    </section>
  );
}
