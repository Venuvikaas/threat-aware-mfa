/**
 * Mock session and geo providers (EXECUTION_new2.md §7).
 *
 * - FAILED_LOGIN_BURST from the session context.
 * - GEO_DISTANCE_ANOMALY from geo/IP context.
 *
 * Conservative defaults; demo overrides drive the hero scenarios. A throwing
 * provider yields an explicit UNAVAILABLE observation, never fabricated safe
 * data.
 */
import type { EvidenceProvider, ProviderContext, ProviderObservation } from "./evidenceProvider.js";
import { MockDeviceProvider } from "./mockDeviceProvider.js";
import { MockTelecomProvider } from "./mockTelecomProvider.js";

export class MockSessionProvider implements EvidenceProvider {
  readonly providerId = "mock_session";
  readonly providerType = "session";
  readonly evidenceType = "FAILED_LOGIN_BURST" as const;

  collect(_ctx: ProviderContext): ProviderObservation {
    try {
      return {
        type: this.evidenceType,
        value: false,
        providerId: this.providerId,
        providerType: this.providerType,
        validUntil: null,
        quality: "REPORTED",
      };
    } catch {
      return {
        type: this.evidenceType,
        value: null,
        providerId: `${this.providerId}_unavailable`,
        providerType: this.providerType,
        validUntil: null,
        quality: "UNKNOWN",
      };
    }
  }
}

export class MockGeoProvider implements EvidenceProvider {
  readonly providerId = "mock_geo";
  readonly providerType = "geo";
  readonly evidenceType = "GEO_DISTANCE_ANOMALY" as const;

  collect(_ctx: ProviderContext): ProviderObservation {
    try {
      return {
        type: this.evidenceType,
        value: false,
        providerId: this.providerId,
        providerType: this.providerType,
        validUntil: null,
        quality: "REPORTED",
      };
    } catch {
      return {
        type: this.evidenceType,
        value: null,
        providerId: `${this.providerId}_unavailable`,
        providerType: this.providerType,
        validUntil: null,
        quality: "UNKNOWN",
      };
    }
  }
}

/** Providers registered for every decision (all mock, all labeled synthetic). */
export const DEFAULT_EVIDENCE_PROVIDERS: EvidenceProvider[] = [
  new MockTelecomProvider(),
  new MockDeviceProvider(),
  new MockSessionProvider(),
  new MockGeoProvider(),
];
