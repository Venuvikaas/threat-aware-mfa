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

const FACTOR_NAMES: Partial<Record<FactorEvaluation["factorId"], string>> = {
  sms_otp: "SMS OTP",
  passkey: "Passkey",
};

export function FactorCard({ factor, selected }: FactorCardProps) {
  // Defensive: if a factor id has no metadata, show the id itself rather
  // than crashing or rendering an empty card.
  const displayName = FACTOR_NAMES[factor.factorId] ?? factor.factorId;
  const stateLabel = STATE_LABELS[factor.state] ?? factor.state;

  return (
    <article
      className={`factor-card factor-${factor.state}${selected ? " is-selected" : ""}`}
    >
      <div className="factor-card-head">
        <span className={`factor-state-dot state-${factor.state}`} aria-hidden="true" />
        <h4 className="factor-card-name">{displayName}</h4>
        <span className="factor-state-label">{stateLabel}</span>
        {selected && <span className="factor-selected-badge">Selected</span>}
      </div>
      <p className="factor-reason">{factor.reason}</p>
      <p className="factor-reason-code">
        <code>{factor.reasonCode}</code>
      </p>
    </article>
  );
}
