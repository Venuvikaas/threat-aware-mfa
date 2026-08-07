/**
 * Hero scenario 1: SIM-channel compromise (EXECUTION_new2.md §11 Scene 1).
 *
 * ₹50,000 transfer from a brand-new device after a recent SIM change.
 * Expected chain (derived, never hardcoded):
 *
 *   RECENT_SIM_CHANGE (fresh primary)
 *     -> SIM_CHANNEL_COMPROMISE support STRONG
 *     -> SIM_OWNERSHIP DISTRUSTED, TELECOM_DELIVERY DISTRUSTED
 *     -> SMS OTP requires SIM_OWNERSHIP >= TRUSTED   -> INELIGIBLE
 *     -> Passkey (enrolled)                          -> ELIGIBLE -> selected
 *     -> TOTP (no seed)                              -> UNAVAILABLE
 *     -> PIN requires SESSION_INTEGRITY >= TRUSTED   -> INELIGIBLE (device concern)
 *
 * Risk: HIGH (RECENT_SIM_CHANGE + HIGH_VALUE_TRANSACTION).
 */
import type { CreateDecisionRequest } from "@mfa/contracts";

export const SIM_SWAP_SCENARIO_ID = "sim_swap";

export interface ScenarioFactory {
  /** Build a unique request; clientTransactionId must differ per submission. */
  build(clientTransactionId: string): CreateDecisionRequest;
}

export const simSwapScenario: ScenarioFactory = {
  build(clientTransactionId) {
    return {
      userId: "user_demo_01",
      clientTransactionId,
      transaction: {
        amountMinor: 5_000_000, // ₹50,000
        currency: "INR",
        payeeId: "payee_new_77",
        payeeIsKnown: false,
      },
      session: {
        sessionId: "sess_unusual_01",
        deviceId: "dev_new_01",
        ageSeconds: 120,
        failedLoginCount: 2,
        ipAddress: "198.51.100.44",
        asn: "AS16509",
        country: "US",
      },
      evidenceOverrides: [
        { type: "RECENT_SIM_CHANGE", value: true },
        { type: "HIGH_VALUE_TRANSACTION", value: true },
        { type: "FIRST_SEEN_DEVICE", value: true },
        { type: "FAILED_LOGIN_BURST", value: true },
        { type: "NEW_PAYEE", value: true },
      ],
    };
  },
};
