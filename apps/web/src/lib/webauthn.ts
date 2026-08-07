/**
 * Browser-side WebAuthn helpers (docs/EXECUTION_new.md Phase 7).
 *
 * Wraps @simplewebauthn/browser. Feature detection is explicit so the UI can
 * tell the presenter whether a real ceremony will run here or whether the
 * labeled SIMULATED fallback is in effect.
 */
import {
  browserSupportsWebAuthn,
  startAuthentication,
  startRegistration,
} from "@simplewebauthn/browser";
import type {
  AuthenticationResponseJSON,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
} from "@simplewebauthn/browser";
import { api } from "./api";

/**
 * True when the current page can run a real WebAuthn ceremony: a secure
 * context (https or localhost) plus a browser that supports WebAuthn.
 */
export function isWebAuthnAvailable(): boolean {
  return (
    typeof window !== "undefined" &&
    window.isSecureContext === true &&
    browserSupportsWebAuthn()
  );
}

/** Run a full registration ceremony: options → browser attestation → verify. */
export async function enrollPasskey(userId: string): Promise<{
  credentialId: string;
  passkeyEnrolled: boolean;
}> {
  const { ceremonyId, options } = await api.passkeyRegisterOptions(userId);
  const response: RegistrationResponseJSON = await startRegistration({
    optionsJSON: options as unknown as PublicKeyCredentialCreationOptionsJSON,
  });
  return api.passkeyRegisterVerify({
    ceremonyId,
    response: response as unknown,
  });
}

/** Run the browser half of an authentication ceremony for a WEBAUTHN challenge. */
export async function getPasskeyAssertion(
  options: unknown
): Promise<AuthenticationResponseJSON> {
  return startAuthentication({
    optionsJSON: options as unknown as PublicKeyCredentialRequestOptionsJSON,
  });
}
