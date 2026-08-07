/**
 * API client for the Threat-Aware MFA Decision Service.
 *
 * The frontend only submits requests and renders responses — it never
 * calculates risk, threat, or factor eligibility (docs/EXECUTION.md PART 3).
 * The Vite dev server proxies /api and /health to the API on port 4000.
 */
import type {
  AuditEvent,
  CreateChallengeRequest,
  CreateChallengeResponse,
  CreateDecisionRequest,
  CreateDecisionResponse,
  FactorId,
  PasskeyRegisterOptionsResponse,
  PasskeyRegisterVerifyRequest,
  PasskeyRegisterVerifyResponse,
  VerifyChallengeResponse,
} from "@mfa/contracts";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    let body: { error?: { code?: string; message?: string; details?: unknown } } = {};
    try {
      body = (await res.json()) as typeof body;
    } catch {
      // non-JSON error body
    }
    throw new ApiError(
      res.status,
      body.error?.code ?? "HTTP_ERROR",
      body.error?.message ?? `Request failed with status ${res.status}`,
      body.error?.details
    );
  }
  return (await res.json()) as T;
}

export interface DemoUser {
  id: string;
  name: string;
  passkeyEnrolled: boolean;
  /** Real WebAuthn credentials (public data only) — drives ceremony vs fallback. */
  passkeys: { id: string; createdAt: string }[];
  devices: { id: string; trusted: boolean; browserFingerprint: string }[];
}

export interface BaselineResult {
  requiredAssurance: number;
  requirement: string;
}

export interface StoredSignal {
  name: string;
  value: unknown;
  source: string;
  synthetic: boolean;
  observedAt: string;
}

export const api = {
  health: () => request<{ status: string; database: string }>("/health"),

  createDecision: (req: CreateDecisionRequest) =>
    request<CreateDecisionResponse>("/api/v1/decisions", {
      method: "POST",
      body: JSON.stringify(req),
    }),

  getDecision: (id: string) =>
    request<CreateDecisionResponse>(`/api/v1/decisions/${id}`),

  getAudit: (id: string) =>
    request<AuditEvent[]>(`/api/v1/decisions/${id}/audit`),

  getSignals: (id: string) =>
    request<StoredSignal[]>(`/api/v1/decisions/${id}/signals`),

  createChallenge: (req: CreateChallengeRequest) =>
    request<CreateChallengeResponse>("/api/v1/challenges", {
      method: "POST",
      body: JSON.stringify(req),
    }),

  verifyChallenge: (challengeId: string, response: unknown) =>
    request<VerifyChallengeResponse>(`/api/v1/challenges/${challengeId}/verify`, {
      method: "POST",
      body: JSON.stringify({ challengeId, response }),
    }),

  demoUsers: () => request<{ users: DemoUser[] }>("/api/v1/demo/users"),

  baseline: (riskLevel: "LOW" | "MEDIUM" | "HIGH") =>
    request<BaselineResult>(`/api/v1/demo/baseline?riskLevel=${riskLevel}`),

  setPasskeyEnrolled: (userId: string, enrolled: boolean) =>
    request<{ userId: string; passkeyEnrolled: boolean }>(
      `/api/v1/demo/users/${userId}/passkey-enrollment`,
      { method: "POST", body: JSON.stringify({ enrolled }) }
    ),

  /** Begin a real WebAuthn registration ceremony for a demo user. */
  passkeyRegisterOptions: (userId: string) =>
    request<PasskeyRegisterOptionsResponse>("/api/v1/passkeys/register/options", {
      method: "POST",
      body: JSON.stringify({ userId }),
    }),

  /** Verify + persist the credential returned by the browser ceremony. */
  passkeyRegisterVerify: (req: PasskeyRegisterVerifyRequest) =>
    request<PasskeyRegisterVerifyResponse>("/api/v1/passkeys/register/verify", {
      method: "POST",
      body: JSON.stringify(req),
    }),

  reset: () =>
    request<{ reset: boolean }>("/api/v1/demo/reset", { method: "POST" }),
};

export type { FactorId };
