/**
 * Capability contracts (EXECUTION_new2.md §4.4).
 *
 * Capabilities are user/device properties required by factors
 * (PASSKEY_ENROLLED, WEBAUTHN_SUPPORTED, NETWORK_AVAILABLE, TOTP_SEED).
 * Capability filtering is separate from threat incompatibility: a missing
 * capability makes a factor UNAVAILABLE, never INELIGIBLE.
 */
import { z } from "zod";

export const CAPABILITY_IDS = [
  "PASSKEY_ENROLLED",
  "WEBAUTHN_SUPPORTED",
  "NETWORK_AVAILABLE",
  "TOTP_SEED",
] as const;
export type CapabilityId = (typeof CAPABILITY_IDS)[number];

export const zCapabilityState = z.object({
  capabilityId: z.enum(CAPABILITY_IDS),
  available: z.boolean(),
});
export type CapabilityState = z.infer<typeof zCapabilityState>;

/** Client-supplied capability change (replay fork). */
export const zCapabilityOverride = z.object({
  capabilityId: z.enum(CAPABILITY_IDS),
  available: z.boolean(),
});
export type CapabilityOverride = z.infer<typeof zCapabilityOverride>;
