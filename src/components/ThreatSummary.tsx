import type { Decision } from "../engine/types";

interface ThreatSummaryProps {
  decision: Decision;
}

const HYPOTHESIS_LABELS: Record<Decision["hypothesis"], string> = {
  sim_channel_compromise: "SIM channel compromise",
  phishing: "Phishing relay",
  insufficient_evidence: "Insufficient evidence",
};

const SUPPORT_LABELS: Record<Decision["supportBand"], string> = {
  high_support: "High support",
  moderate_support: "Moderate support",
  insufficient_evidence: "No supported hypothesis",
};

export function ThreatSummary({ decision }: ThreatSummaryProps) {
  return (
    <section className="threat-summary" aria-label="Threat summary">
      <p className="threat-summary-label">Suspected threat</p>
      <h3 className="threat-summary-hypothesis">
        {HYPOTHESIS_LABELS[decision.hypothesis]}
      </h3>
      <p className="threat-summary-band">
        <span className="band-dot" aria-hidden="true" />
        {SUPPORT_LABELS[decision.supportBand]}
      </p>
    </section>
  );
}
