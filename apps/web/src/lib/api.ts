/**
 * API client for the decision console (EXECUTION_new2.md Phase 5/6/7).
 *
 * All product decisions come from API responses; the frontend never computes
 * decisions. Every call surfaces the frozen error shape.
 */
import type {
  CreateChallengeResponse,
  CreateDecisionRequest,
  CreateReplayRequest,
  DecisionDiff,
  DecisionResponse,
  ReplayRecord,
  VerifyChallengeResponse,
} from "@mfa/contracts";

export interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown; correlationId?: string };
}

export class ApiError extends Error {
  readonly code: string;
  readonly details: unknown;
  readonly status: number;

  constructor(status: number, body: ApiErrorBody) {
    super(body.error.message);
    this.name = "ApiError";
    this.code = body.error.code;
    this.details = body.error.details;
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    // non-JSON body
  }
  if (!res.ok) {
    throw new ApiError(res.status, (body ?? { error: { code: "INTERNAL_ERROR", message: `HTTP ${res.status}` } }) as ApiErrorBody);
  }
  return body as T;
}

export const api = {
  health(): Promise<{ status: string; service: string; database: string; time: string }> {
    return request("/health");
  },

  createDecision(req: CreateDecisionRequest): Promise<DecisionResponse> {
    return request("/api/v1/decisions", { method: "POST", body: JSON.stringify(req) });
  },

  getDecision(decisionId: string): Promise<DecisionResponse> {
    return request(`/api/v1/decisions/${decisionId}`);
  },

  getTrace(decisionId: string): Promise<DecisionResponse["trace"]> {
    return request(`/api/v1/decisions/${decisionId}/trace`);
  },

  createChallenge(decisionId: string, factor: string, preferSimulated = false): Promise<CreateChallengeResponse> {
    return request("/api/v1/challenges", {
      method: "POST",
      body: JSON.stringify({ decisionId, factor, preferSimulated }),
    });
  },

  verifyChallenge(challengeId: string, response: unknown): Promise<VerifyChallengeResponse> {
    return request(`/api/v1/challenges/${challengeId}/verify`, {
      method: "POST",
      body: JSON.stringify({ challengeId, response }),
    });
  },

  getDemoScenarios(): Promise<{ scenarios: { id: string; label: string; description: string }[] }> {
    return request("/api/v1/demo/scenarios");
  },

  resetDemo(): Promise<{ reset: boolean; at: string }> {
    return request("/api/v1/demo/reset", { method: "POST" });
  },

  passkeyRegisterOptions(userId: string): Promise<{ ceremonyId: string; options: unknown }> {
    return request("/api/v1/passkeys/register/options", {
      method: "POST",
      body: JSON.stringify({ userId }),
    });
  },

  passkeyRegisterVerify(body: {
    ceremonyId: string;
    response: unknown;
  }): Promise<{ registered: boolean; credentialId: string; passkeyEnrolled: boolean }> {
    return request("/api/v1/passkeys/register/verify", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  createReplay(decisionId: string, req: CreateReplayRequest): Promise<ReplayRecord> {
    return request(`/api/v1/decisions/${decisionId}/replays`, {
      method: "POST",
      body: JSON.stringify(req),
    });
  },

  getReplayDiff(replayId: string): Promise<DecisionDiff> {
    return request(`/api/v1/replays/${replayId}/diff`);
  },

  getReplay(replayId: string): Promise<{ replay: ReplayRecord; decision: DecisionResponse }> {
    return request(`/api/v1/replays/${replayId}`);
  },

  verifyRemediation(
    decisionId: string,
    factorId: string
  ): Promise<{
    decisionId: string;
    factorId: string;
    verified: boolean;
    wouldBecomeEligible: boolean;
    wouldBeSelected: boolean;
    changeSets: { capabilityChanges?: { capabilityId: string; available: boolean }[]; evidenceChanges?: { type: string; value: unknown }[] }[];
  }> {
    return request(`/api/v1/decisions/${decisionId}/remediations/${factorId}/verify`, {
      method: "POST",
      body: JSON.stringify({}),
    });
  },
};
