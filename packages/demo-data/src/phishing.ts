/**
 * Hero scenario 2: phishing relay (EXECUTION_new2.md §11 Scene 3).
 *
 * The same ₹50,000 risk level as the SIM-swap scenario, but the evidence
 * points at a phishing relay instead of a SIM change. The whole point of the
 * demo: equal risk, different trust impacts, different rule activations.
 *
 * Expected chain (derived):
 *
 *   PHISHING_RELAY_INDICATOR (fresh primary) + FAILED_LOGIN_BURST
 *     -> PHISHING_RELAY support STRONG
 *     -> TELECOM_DELIVERY DISTRUSTED, USER_VERIFICATION DEGRADED
 *     -> SMS OTP requires TELECOM_DELIVERY >= TRUSTED -> INELIGIBLE
 *        (relayable delivery — a *different* failure than the SIM scenario)
 *     -> Passkey (enrolled, phishing-resistant)      -> ELIGIBLE -> selected
 *
 * SIM_OWNERSHIP stays TRUSTED here — no SIM change evidence — so the trust
 * trace differs from the SIM-swap decision even though risk is identical.
 */
import type { CreateDecisionRequest } from "@mfa/contracts";

export const PHISHING_SCENARIO_ID = "phishing_relay";

export const phishingScenario = {
  build(clientTransactionId: string): CreateDecisionRequest {
    return {
      userId: "user_demo_01",
      clientTransactionId,
      transaction: {
        amountMinor: 5_000_000, // ₹50,000 — same as SIM-swap
        currency: "INR",
        payeeId: "payee_new_88",
        payeeIsKnown: false,
      },
      session: {
        sessionId: "sess_unusual_02",
        deviceId: "dev_trusted_01",
        ageSeconds: 60,
        failedLoginCount: 2,
        ipAddress: "203.0.113.9",
        asn: "AS14061",
        country: "IN",
      },
      evidenceOverrides: [
        { type: "PHISHING_RELAY_INDICATOR", value: true },
        { type: "HIGH_VALUE_TRANSACTION", value: true },
        { type: "FAILED_LOGIN_BURST", value: true },
        { type: "NEW_PAYEE", value: true },
      ],
    };
  },
};
