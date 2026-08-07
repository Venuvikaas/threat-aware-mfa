/**
 * Hero scenario presets (docs/EXECUTION.md Phase 5).
 *
 * These are REQUEST payloads. Both scenarios share the same aggregate risk
 * (₹50,000, new payee) while the threat composition differs. All decisions
 * are computed by the backend — this file only supplies inputs.
 */
import type { CreateDecisionRequest } from "@mfa/contracts";

const AMOUNT_RUPEES_50000_MINOR = 5_000_000;

export function simSwapPreset(): CreateDecisionRequest {
  return {
    userId: "user_demo_01",
    transaction: {
      clientTransactionId: `hero_simswap_${Date.now()}`,
      amountMinor: AMOUNT_RUPEES_50000_MINOR,
      currency: "INR",
      payeeId: "payee_new_77",
      payeeIsKnown: false,
    },
    session: {
      sessionId: "sess_unusual_01",
      ageSeconds: 120,
      failedLoginCount: 2,
      ipAddress: "198.51.100.44",
      asn: "AS16509",
      country: "US",
    },
    device: {
      deviceId: "dev_new_01",
      trusted: false,
      firstSeen: true,
      browserFingerprint: "fp-unregistered-mobile-42c1",
    },
    signals: {
      recentSimChange: true,
      geoDistanceFromLastLoginKm: null,
      phishingRelayIndicator: false,
    },
  };
}

export function phishingPreset(): CreateDecisionRequest {
  return {
    userId: "user_demo_01",
    transaction: {
      clientTransactionId: `hero_phishing_${Date.now()}`,
      amountMinor: AMOUNT_RUPEES_50000_MINOR,
      currency: "INR",
      payeeId: "payee_new_88",
      payeeIsKnown: false,
    },
    session: {
      sessionId: "sess_unusual_02",
      ageSeconds: 60,
      failedLoginCount: 2,
      ipAddress: "203.0.113.9",
      asn: "AS14061",
      country: "IN",
    },
    device: {
      deviceId: "dev_trusted_01",
      trusted: true,
      firstSeen: false,
      browserFingerprint: "fp-home-chrome-win-7a9f",
    },
    signals: {
      recentSimChange: null,
      geoDistanceFromLastLoginKm: null,
      phishingRelayIndicator: true,
    },
  };
}

export interface ScenarioMeta {
  key: string;
  label: string;
  tagline: string;
  build: () => CreateDecisionRequest;
}

export const HERO_SCENARIOS: ScenarioMeta[] = [
  {
    key: "sim-swap",
    label: "SIM swap",
    tagline: "Recent SIM change + new device",
    build: simSwapPreset,
  },
  {
    key: "phishing",
    label: "Phishing relay",
    tagline: "Relay indicator + unusual session",
    build: phishingPreset,
  },
];
