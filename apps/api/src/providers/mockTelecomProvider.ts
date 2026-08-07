/**
 * Mock telecom provider (EXECUTION_new2.md §7).
 *
 * Reports RECENT_SIM_CHANGE. The mock never sees a real carrier — it returns
 * a conservative default (false, meaning "no observed change") that demo
 * overrides replace for the hero scenario. A throwing provider yields an
 * explicit UNAVAILABLE observation, never fabricated safe data.
 */
import type { EvidenceProvider, ProviderContext, ProviderObservation } from "./evidenceProvider.js";

export class MockTelecomProvider implements EvidenceProvider {
  readonly providerId = "mock_telco";
  readonly providerType = "telco";
  readonly evidenceType = "RECENT_SIM_CHANGE" as const;

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
