/**
 * Evidence provider boundary (EXECUTION_new2.md §7, Phase 3).
 *
 * A provider simulates an upstream contract (telco, device risk, session/geo)
 * and returns raw observations. Every observation carries full provenance:
 * provider id and type, quality, and an optional validity window. Providers
 * never fabricate safe data — a failing provider returns an UNAVAILABLE
 * observation (value null), which the freshness evaluator treats
 * conservatively.
 */
import type { EvidenceQuality, EvidenceType, EvidenceValue } from "@mfa/contracts";

export interface ProviderContext {
  userId: string;
  deviceId: string;
  sessionId: string;
}

export interface ProviderObservation {
  type: EvidenceType;
  value: EvidenceValue;
  /** Stability: provider owns exactly one evidence type. */
  providerId: string;
  providerType: string;
  validUntil?: string | null;
  quality: EvidenceQuality;
}

export interface EvidenceProvider {
  readonly providerId: string;
  readonly providerType: string;
  readonly evidenceType: EvidenceType;
  collect(_ctx: ProviderContext): ProviderObservation;
}
