import type { Policy } from "../engine/types";
import { REASON_CODES } from "./reasonCodes";

/**
 * Versioned static policy fixture.
 *
 * This is committed policy data — not a configurable system. Every rule below
 * is defensible in one sentence for the demo:
 *
 * - A recent SIM change places the phone number (SMS channel) under suspicion.
 * - A phishing-relay indicator places one-time code delivery under suspicion.
 * - SMS OTP depends on the channel or delivery path under suspicion.
 * - Passkeys are origin-bound and not relayable under the documented threats.
 * - High-risk payments require phishing-resistant assurance (>= 2).
 */
export const DEMO_POLICY_VERSION = "demo-policy-1.0.0";

export const demoPolicy: Policy = {
  version: DEMO_POLICY_VERSION,

  threats: {
    simChannelCompromise: {
      supportBand: "high_support",
      doNotTrust: ["Phone number (SMS channel)"],
      reasonCode: REASON_CODES.RECENT_SIM_CHANGE,
      reason:
        "A recent SIM change places control of the phone number under suspicion.",
    },
    phishing: {
      supportBand: "high_support",
      doNotTrust: ["SMS relay path (one-time code delivery)"],
      reasonCode: REASON_CODES.PHISHING_RELAY_SIGNAL,
      reason:
        "A phishing relay indicator places one-time code delivery under suspicion.",
    },
    insufficientEvidence: {
      supportBand: "insufficient_evidence",
      doNotTrust: [],
      reasonCode: REASON_CODES.INSUFFICIENT_EVIDENCE,
      reason:
        "No supported primary indicator is present, so the policy declines to name a confident threat.",
    },
  },

  factors: [
    {
      factorId: "sms_otp",
      displayName: "SMS OTP",
      assurance: 1,
      incompatibleWith: ["sim_channel_compromise", "phishing"],
      excludedReasonByHypothesis: {
        sim_channel_compromise: {
          reasonCode: REASON_CODES.SMS_CHANNEL_UNTRUSTED,
          reason:
            "SMS OTP routes through the phone number under suspicion, so the policy marks it incompatible with this suspected failure path.",
        },
        phishing: {
          reasonCode: REASON_CODES.FACTOR_RELAYABLE,
          reason:
            "SMS OTP codes can be relayed to a phishing attacker, so the policy marks the factor relayable and incompatible.",
        },
      },
      availabilityRequirement: "none",
      unavailableReason: {
        reasonCode: REASON_CODES.INSUFFICIENT_EVIDENCE,
        reason:
          "SMS OTP has no capability gate in this policy; it is evaluated on threat compatibility and assurance only.",
      },
      assuranceBelowReason: {
        reasonCode: REASON_CODES.ASSURANCE_TOO_LOW,
        reason:
          "SMS OTP assurance does not meet the required phishing-resistant assurance for this payment.",
      },
      eligibleReason: {
        reasonCode: REASON_CODES.ELIGIBLE,
        reason:
          "SMS OTP is compatible with the suspected threat and meets the assurance requirement.",
      },
      selectionMessage: "Use your SMS OTP to authorize this payment.",
    },
    {
      factorId: "passkey",
      displayName: "Passkey",
      assurance: 3,
      incompatibleWith: [],
      excludedReasonByHypothesis: {},
      availabilityRequirement: "passkey_enrolled",
      unavailableReason: {
        reasonCode: REASON_CODES.PASSKEY_NOT_ENROLLED,
        reason: "No passkey is enrolled for this user, so the factor is unavailable.",
      },
      assuranceBelowReason: {
        reasonCode: REASON_CODES.ASSURANCE_TOO_LOW,
        reason:
          "Passkey assurance does not meet the required phishing-resistant assurance for this payment.",
      },
      eligibleReason: {
        reasonCode: REASON_CODES.ELIGIBLE,
        reason:
          "Passkey is origin-bound, compatible with the suspected threat, and above the assurance threshold.",
      },
      selectionMessage: "Use your passkey to authorize this payment.",
    },
  ],

  preferenceOrder: ["passkey", "sms_otp"],

  assistedRecoveryMessage:
    "Payment paused. Continue through assisted recovery.",
};
