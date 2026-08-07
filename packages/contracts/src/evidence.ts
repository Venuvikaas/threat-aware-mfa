/**
 * Evidence contracts (EXECUTION_new2.md §4.1).
 *
 * Evidence is a normalized observation with full provenance: provider id and
 * type, observation time, synthetic status, quality, and a validity window
 * that drives its status (ACTIVE / STALE / UNAVAILABLE).
 */
import { z } from "zod";

export const EVIDENCE_TYPES = [
  "RECENT_SIM_CHANGE",
  "FIRST_SEEN_DEVICE",
  "NEW_PAYEE",
  "HIGH_VALUE_TRANSACTION",
  "PHISHING_RELAY_INDICATOR",
  "FAILED_LOGIN_BURST",
  "GEO_DISTANCE_ANOMALY",
  "PASSKEY_ENROLLED",
  "WEBAUTHN_SUPPORTED",
  "NETWORK_AVAILABLE",
] as const;
export type EvidenceType = (typeof EVIDENCE_TYPES)[number];

export const EVIDENCE_QUALITIES = ["CONFIRMED", "REPORTED", "UNKNOWN"] as const;
export type EvidenceQuality = (typeof EVIDENCE_QUALITIES)[number];

export const EVIDENCE_STATUSES = ["ACTIVE", "STALE", "UNAVAILABLE"] as const;
export type EvidenceStatus = (typeof EVIDENCE_STATUSES)[number];

export const zEvidenceValue = z.union([
  z.boolean(),
  z.number(),
  z.string(),
  z.null(),
]);
export type EvidenceValue = z.infer<typeof zEvidenceValue>;

export const zEvidenceItem = z.object({
  id: z.string().min(1),
  type: z.enum(EVIDENCE_TYPES),
  value: zEvidenceValue,
  providerId: z.string().min(1),
  providerType: z.string().min(1),
  observedAt: z.string().min(1),
  validUntil: z.string().nullable(),
  synthetic: z.boolean(),
  quality: z.enum(EVIDENCE_QUALITIES),
  status: z.enum(EVIDENCE_STATUSES),
});
export type EvidenceItem = z.infer<typeof zEvidenceItem>;

/** Client-supplied evidence override (demo mode / replay fork). */
export const zEvidenceOverride = z.object({
  type: z.enum(EVIDENCE_TYPES),
  value: zEvidenceValue,
});
export type EvidenceOverride = z.infer<typeof zEvidenceOverride>;
