/**
 * Stable reason codes and approved explanation copy.
 *
 * The engine never invents prose: every reason shown in the UI resolves to a
 * constant reason code and committed copy defined here or in `demoPolicy.ts`.
 */

export const REASON_CODES = {
  RECENT_SIM_CHANGE: "RECENT_SIM_CHANGE",
  PHISHING_RELAY_SIGNAL: "PHISHING_RELAY_SIGNAL",
  SMS_CHANNEL_UNTRUSTED: "SMS_CHANNEL_UNTRUSTED",
  FACTOR_RELAYABLE: "FACTOR_RELAYABLE",
  PASSKEY_NOT_ENROLLED: "PASSKEY_NOT_ENROLLED",
  ASSURANCE_TOO_LOW: "ASSURANCE_TOO_LOW",
  INSUFFICIENT_EVIDENCE: "INSUFFICIENT_EVIDENCE",
  ELIGIBLE: "ELIGIBLE",
} as const;

export type ReasonCode = (typeof REASON_CODES)[keyof typeof REASON_CODES];

/** Human-readable labels for observed evidence chips. */
export const EVIDENCE_LABELS = {
  recentSimChange: "Recent SIM change",
  phishingRelayIndicator: "Phishing relay indicator",
  newDevice: "New device",
  unusualSession: "Unusual session",
  newPayee: "New payee",
} as const;

export type EvidenceLabelKey = keyof typeof EVIDENCE_LABELS;
