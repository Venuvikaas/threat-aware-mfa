import type { FactorEvaluation } from "../engine/types";

interface FactorCardProps {
  factor: FactorEvaluation;
  selected: boolean;
}

const STATE_LABELS: Record<FactorEvaluation["state"], string> = {
  eligible: "Eligible",
  excluded: "Excluded",
  unavailable: "Unavailable",
};

export function FactorCard({ factor, selected }: FactorCardProps) {
  const displayName =
    factor.factorId === "passkey" ? "Passkey" : "SMS OTP";

  return (
    <article
      className={`factor-card factor-${factor.state}${selected ? " is-selected" : ""}`}
    >
      <div className="factor-card-head">
        <span className={`factor-state-dot state-${factor.state}`} aria-hidden="true" />
        <h4 className="factor-card-name">{displayName}</h4>
        <span className="factor-state-label">{STATE_LABELS[factor.state]}</span>
        {selected && <span className="factor-selected-badge">Selected</span>}
      </div>
      <p className="factor-reason">{factor.reason}</p>
      <p className="factor-reason-code">
        <code>{factor.reasonCode}</code>
      </p>
    </article>
  );
}
