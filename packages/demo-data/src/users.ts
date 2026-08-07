/**
 * Synthetic demo identities and capability profiles (EXECUTION_new2.md §5.6).
 *
 * Only synthetic users live in this database. Capability profiles drive the
 * capability gate: a missing PASSKEY_ENROLLED makes passkey UNAVAILABLE
 * (never INELIGIBLE), which is exactly the constrained-capability scenario.
 */
import type { CapabilityId } from "@mfa/contracts";

export interface DemoUser {
  id: string;
  name: string;
  /** Default capability profile for this synthetic user. */
  capabilities: Record<CapabilityId, boolean>;
}

export const DEMO_USERS: DemoUser[] = [
  {
    id: "user_demo_01",
    name: "Aarav Nair",
    capabilities: {
      PASSKEY_ENROLLED: true,
      WEBAUTHN_SUPPORTED: true,
      NETWORK_AVAILABLE: true,
      TOTP_SEED: false,
    },
  },
  {
    id: "user_demo_02",
    name: "Priya Sharma",
    capabilities: {
      PASSKEY_ENROLLED: false,
      WEBAUTHN_SUPPORTED: true,
      NETWORK_AVAILABLE: true,
      TOTP_SEED: false,
    },
  },
];

export function capabilitiesFor(userId: string): Record<CapabilityId, boolean> {
  return (
    DEMO_USERS.find((u) => u.id === userId)?.capabilities ?? {
      PASSKEY_ENROLLED: false,
      WEBAUTHN_SUPPORTED: false,
      NETWORK_AVAILABLE: true,
      TOTP_SEED: false,
    }
  );
}
