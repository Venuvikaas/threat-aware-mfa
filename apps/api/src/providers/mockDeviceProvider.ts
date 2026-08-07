/**
 * Mock device provider (EXECUTION_new2.md §7).
 *
 * Reports FIRST_SEEN_DEVICE based on the device profile. Conservative
 * default is false (a known device); the demo overrides it for the hero
 * scenarios where the transaction originates from a brand-new device.
 */
import type { EvidenceProvider, ProviderContext, ProviderObservation } from "./evidenceProvider.js";

export class MockDeviceProvider implements EvidenceProvider {
  readonly providerId = "mock_device";
  readonly providerType = "device_profile";
  readonly evidenceType = "FIRST_SEEN_DEVICE" as const;

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
