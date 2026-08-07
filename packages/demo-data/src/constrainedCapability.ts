/**
 * Capability-constrained scenario (EXECUTION_new2.md §11 Scene 4 / Phase 3
 * "capability fallback" test).
 *
 * Same SIM-change evidence as the hero SIM-swap scenario, but for a user who
 * has NO passkey enrolled and no TOTP seed. Capability filtering is separate
 * from threat incompatibility:
 *
 *   SMS OTP  -> INELIGIBLE   (SIM_OWNERSHIP DISTRUSTED)
 *   PASSKEY  -> UNAVAILABLE  (capability PASSKEY_ENROLLED missing — not a
 *                             threat outcome)
 *   TOTP     -> UNAVAILABLE  (capability TOTP_SEED missing)
 *   PIN      -> INELIGIBLE   (SESSION_INTEGRITY DEGRADED by device concern)
 *
 * No eligible factor remains -> action ASSISTED_RECOVERY.
 */
import type { CreateDecisionRequest } from "@mfa/contracts";

export const CONSTRAINED_SCENARIO_ID = "constrained_capability";

export const constrainedCapabilityScenario = {
  build(clientTransactionId: string): CreateDecisionRequest {
    return {
      userId: "user_demo_02",
      clientTransactionId,
      transaction: {
        amountMinor: 5_000_000, // ₹50,000 — same risk level
        currency: "INR",
        payeeId: "payee_new_99",
        payeeIsKnown: false,
      },
      session: {
        sessionId: "sess_unusual_03",
        deviceId: "dev_new_01",
        ageSeconds: 90,
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
      ],
    };
  },
};
