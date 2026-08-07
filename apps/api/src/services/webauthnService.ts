/**
 * WebAuthn ceremony service (docs/EXECUTION_new.md Phase 7).
 *
 * Real passkey registration and authentication via SimpleWebAuthn. Server
 * challenge state is bound to the user (registration) or stored inside the
 * decision-bound factor challenge (authentication) so the verify step always
 * checks the exact challenge, origin, and relying-party ID the client was
 * issued — plus credential ownership. Only PUBLIC credential material is
 * persisted (credential id, COSE public key, counter, transports).
 *
 * The demo origin must be a WebAuthn-capable secure context. RP config is
 * derived from the request Origin header so the ceremony works on whatever
 * host the demo is presented from; it falls back to a configurable default.
 *
 * `requireUserVerification` is intentionally relaxed (`false`) and the
 * registration options ask for `preferred` UV: this is a demo-scoped choice
 * to keep the ceremony low-friction. A production deployment should require
 * user verification.
 */
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import type {
  AuthenticationResponseJSON,
  AuthenticatorTransportFuture,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
} from "@simplewebauthn/server";
import type { Db } from "../db/connection.js";
import { newId } from "../lib/ids.js";
import { challengeError, notFoundError } from "../middleware/errorHandler.js";
import {
  PasskeyCredentialRepository,
  PasskeyRegistrationRepository,
} from "../repositories/passkeyRepository.js";
import { UserRepository } from "../repositories/userRepository.js";
import { CapabilityRepository } from "../repositories/capabilityRepository.js";

const RP_NAME = "Threat-Aware MFA";
/** Fallback origin when a request carries no Origin header (curl, same-origin). */
const DEFAULT_ORIGIN = process.env.WEBAUTHN_ORIGIN ?? "http://localhost:5173";
const CEREMONY_TTL_MS = 5 * 60 * 1000;
const SUPPORTED_ALGORITHMS = [-7, -257] as const;

/**
 * Resolve the origin a ceremony is bound to. Uses the request Origin header
 * when present and a valid URL, normalized to scheme+host (a path-carrying
 * header would otherwise fail every real ceremony, because the browser signs
 * the origin without a path). Falls back to the configured default.
 */
export function resolveOrigin(originHeader: string | undefined): string {
  if (originHeader) {
    try {
      return new URL(originHeader).origin;
    } catch {
      // malformed header — fall through to the default
    }
  }
  return DEFAULT_ORIGIN;
}

/** Server-side state stored with a decision-bound WEBAUTHN challenge. */
export interface AuthChallengeData {
  webauthn: true;
  challenge: string;
  expectedOrigin: string;
  rpId: string;
  userId: string;
}

export interface RegistrationOptionsResult {
  ceremonyId: string;
  options: PublicKeyCredentialCreationOptionsJSON;
}

type RegistrationVerification = Awaited<ReturnType<typeof verifyRegistrationResponse>>;

export class WebAuthnService {
  private readonly credentials: PasskeyCredentialRepository;
  private readonly registrations: PasskeyRegistrationRepository;
  private readonly users: UserRepository;
  private readonly capabilities: CapabilityRepository;

  constructor(private readonly db: Db) {
    this.credentials = new PasskeyCredentialRepository(db);
    this.registrations = new PasskeyRegistrationRepository(db);
    this.users = new UserRepository(db);
    this.capabilities = new CapabilityRepository(db);
  }

  /** True only for origins WebAuthn can run in: https or a localhost alias. */
  isSecureWebAuthnOrigin(origin: string): boolean {
    let url: URL;
    try {
      url = new URL(origin);
    } catch {
      return false;
    }
    if (url.protocol === "https:") return true;
    if (url.protocol !== "http:") return false;
    const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
    return host === "localhost" || host === "127.0.0.1" || host === "::1";
  }

  private rpId(origin: string): string {
    return new URL(origin).hostname.replace(/^\[|\]$/g, "");
  }

  hasCredentials(userId: string): boolean {
    return this.credentials.findByUserId(userId).length > 0;
  }

  /* ---------------------------------------------------------------- */
  /* Registration                                                     */
  /* ---------------------------------------------------------------- */

  async beginRegistration(
    userId: string,
    origin: string
  ): Promise<RegistrationOptionsResult> {
    const user = this.users.findById(userId);
    if (!user) {
      throw notFoundError(`User ${userId} not found`);
    }
    const existing = this.credentials.findByUserId(userId);

    const options = await generateRegistrationOptions({
      rpName: RP_NAME,
      rpID: this.rpId(origin),
      userName: user.name,
      userID: new Uint8Array(Buffer.from(userId, "utf8")),
      userDisplayName: user.name,
      timeout: 120_000,
      attestationType: "none",
      excludeCredentials: existing.map((c) => ({ id: c.id })),
      authenticatorSelection: {
        residentKey: "discouraged",
        userVerification: "preferred",
      },
      supportedAlgorithmIDs: [...SUPPORTED_ALGORITHMS],
    });

    const now = new Date();
    const ceremonyId = newId("reg");
    this.registrations.create({
      id: ceremonyId,
      userId,
      challenge: options.challenge,
      expectedOrigin: origin,
      rpId: this.rpId(origin),
      expiresAt: new Date(now.getTime() + CEREMONY_TTL_MS).toISOString(),
      consumedAt: null,
      createdAt: now.toISOString(),
    });

    return { ceremonyId, options };
  }

  /**
   * Verify a registration response and persist the public credential.
   * Verifies challenge, origin, RP ID, and supported algorithms; rejects
   * missing, expired, and already-consumed ceremonies; consumes the ceremony
   * and stores the credential atomically.
   */
  async completeRegistration(input: {
    ceremonyId: string;
    response: RegistrationResponseJSON;
  }): Promise<{ credentialId: string; registered: true; passkeyEnrolled: boolean }> {
    const ceremony = this.registrations.findById(input.ceremonyId);
    if (!ceremony) {
      throw notFoundError(`Registration ceremony ${input.ceremonyId} not found`);
    }
    const now = new Date();
    if (ceremony.expiresAt <= now.toISOString()) {
      throw challengeError(`Registration ceremony ${input.ceremonyId} has expired`);
    }
    if (ceremony.consumedAt !== null) {
      throw challengeError(`Registration ceremony ${input.ceremonyId} was already used`);
    }

    let verification: RegistrationVerification;
    try {
      verification = await verifyRegistrationResponse({
        response: input.response,
        expectedChallenge: ceremony.challenge,
        expectedOrigin: ceremony.expectedOrigin,
        expectedRPID: ceremony.rpId,
        requireUserVerification: false,
        supportedAlgorithmIDs: [...SUPPORTED_ALGORITHMS],
      });
    } catch (err) {
      throw challengeError("Registration verification failed", {
        reason: err instanceof Error ? err.message : String(err),
      });
    }

    if (!verification.verified || !verification.registrationInfo) {
      throw challengeError("Registration could not be verified");
    }

    const info = verification.registrationInfo;
    const credential = info.credential;

    const apply = this.db.transaction(() => {
      const consumed = this.registrations.consume(input.ceremonyId, now.toISOString());
      if (!consumed) {
        throw challengeError(`Registration ceremony ${input.ceremonyId} was already used`);
      }
      this.credentials.create({
        id: credential.id,
        userId: ceremony.userId,
        publicKey: Buffer.from(credential.publicKey).toString("base64url"),
        counter: credential.counter,
        transports: credential.transports ?? [],
        deviceType: info.credentialDeviceType,
        backedUp: info.credentialBackedUp,
        createdAt: now.toISOString(),
      });
      // Enrollment flips the PASSKEY_ENROLLED capability (capability gate).
      this.capabilities.setAvailable(ceremony.userId, "PASSKEY_ENROLLED", true);
    });

    try {
      apply();
    } catch (err) {
      if (
        typeof err === "object" &&
        err !== null &&
        (err as { code?: string }).code === "SQLITE_CONSTRAINT_UNIQUE"
      ) {
        throw challengeError("This passkey is already registered", {
          credentialId: credential.id,
        });
      }
      throw err;
    }

    return {
      credentialId: credential.id,
      registered: true as const,
      passkeyEnrolled: true,
    };
  }

  /* ---------------------------------------------------------------- */
  /* Authentication (called through the PASSKEY factor adapter)       */
  /* ---------------------------------------------------------------- */

  async beginAuthentication(
    userId: string,
    origin: string
  ): Promise<{
    options: PublicKeyCredentialRequestOptionsJSON;
    challengeData: AuthChallengeData;
  }> {
    const creds = this.credentials.findByUserId(userId);
    const options = await generateAuthenticationOptions({
      rpID: this.rpId(origin),
      timeout: 60_000,
      userVerification: "preferred",
      allowCredentials: creds.map((c) => ({
        id: c.id,
        transports: c.transports as AuthenticatorTransportFuture[],
      })),
    });

    return {
      options,
      challengeData: {
        webauthn: true,
        challenge: options.challenge,
        expectedOrigin: origin,
        rpId: this.rpId(origin),
        userId,
      },
    };
  }

  /**
   * Verify a WebAuthn authentication response against the stored challenge
   * data. Enforces origin, relying-party ID, challenge, and credential
   * ownership. On success returns the new signature counter — the caller
   * persists it atomically with challenge consumption (the counter write is
   * not performed here). Never throws: a failed ceremony is a false verdict.
   */
  async verifyAuthentication(
    response: unknown,
    challengeData: AuthChallengeData
  ): Promise<{ verified: boolean; credentialId?: string; newCounter?: number }> {
    const obj = response as { id?: unknown } | null;
    if (typeof response !== "object" || response === null || typeof obj?.id !== "string") {
      return { verified: false };
    }
    const id = obj.id;

    // Credential ownership: the credential must belong to the user the
    // decision-bound challenge was created for.
    const credential = this.credentials.findByIdAndUser(id, challengeData.userId);
    if (!credential) {
      return { verified: false };
    }

    let result;
    try {
      result = await verifyAuthenticationResponse({
        response: response as AuthenticationResponseJSON,
        expectedChallenge: challengeData.challenge,
        expectedOrigin: challengeData.expectedOrigin,
        expectedRPID: challengeData.rpId,
        requireUserVerification: false,
        credential: {
          id: credential.id,
          publicKey: new Uint8Array(Buffer.from(credential.publicKey, "base64url")),
          counter: credential.counter,
          transports: credential.transports as AuthenticatorTransportFuture[],
        },
      });
    } catch {
      return { verified: false };
    }

    if (!result.verified) {
      return { verified: false };
    }

    return {
      verified: true,
      credentialId: credential.id,
      newCounter: result.authenticationInfo.newCounter,
    };
  }
}
