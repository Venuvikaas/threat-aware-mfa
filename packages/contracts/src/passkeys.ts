/**
 * Passkey registration schemas (EXECUTION_new2.md Stretch A).
 *
 * Real WebAuthn registration is demo-gated (the only users are synthetic).
 * These schemas carry over from the prior build unchanged; public credential
 * data only is persisted.
 */
import { z } from "zod";

export const zPasskeyRegisterOptionsRequest = z.object({
  userId: z.string().min(1),
});
export type PasskeyRegisterOptionsRequest = z.infer<typeof zPasskeyRegisterOptionsRequest>;

export const zPasskeyRegisterOptionsResponse = z.object({
  ceremonyId: z.string().min(1),
  options: z.unknown(),
});
export type PasskeyRegisterOptionsResponse = z.infer<typeof zPasskeyRegisterOptionsResponse>;

export const zPasskeyRegisterVerifyRequest = z.object({
  ceremonyId: z.string().min(1),
  response: z.unknown(),
});
export type PasskeyRegisterVerifyRequest = z.infer<typeof zPasskeyRegisterVerifyRequest>;

export const zPasskeyRegisterVerifyResponse = z.object({
  registered: z.boolean(),
  credentialId: z.string(),
  passkeyEnrolled: z.boolean(),
});
export type PasskeyRegisterVerifyResponse = z.infer<typeof zPasskeyRegisterVerifyResponse>;
