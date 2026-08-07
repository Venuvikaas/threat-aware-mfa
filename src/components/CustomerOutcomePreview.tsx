import type { Decision } from "../engine/types";

interface CustomerOutcomePreviewProps {
  decision: Decision;
}

/**
 * Compact, clearly-labeled preview of what the customer would see.
 *
 * Displays only the two approved messages from the policy fixture. The label
 * and "simulated" wording keep this from looking like authentication is being
 * executed.
 */
export function CustomerOutcomePreview({ decision }: CustomerOutcomePreviewProps) {
  const isRecovery = decision.outcome === "assisted_recovery";

  return (
    <div
      className={`customer-preview${isRecovery ? " is-recovery" : ""}`}
      aria-label="Simulated customer message"
    >
      <p className="customer-preview-label">Simulated customer message</p>
      <p className="customer-preview-bubble">{decision.outcomeMessage}</p>
    </div>
  );
}
