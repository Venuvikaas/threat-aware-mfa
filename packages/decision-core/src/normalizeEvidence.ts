/**
 * Evidence normalization (EXECUTION_new2.md §4.1, Phase 1).
 *
 * Turns raw provider/override observations into normalized EvidenceItems with
 * deterministic ids, full provenance, and a computed status:
 *
 *   - value === null            -> UNAVAILABLE (provider failure / no signal)
 *   - validUntil passed         -> STALE (outside its validity window)
 *   - otherwise                 -> ACTIVE
 *
 * The function is pure and deterministic: the caller supplies the clock
 * (`now`) so replay can re-run with the same inputs and produce identical ids.
 */
import type { EvidenceItem, EvidenceType, EvidenceValue } from "@mfa/contracts";

export interface RawEvidence {
  type: EvidenceType;
  value: EvidenceValue;
  providerId: string;
  providerType: string;
  /** When the observation was made (defaults to `now`). */
  observedAt?: string;
  /** End of the validity window; drives ACTIVE vs STALE. */
  validUntil?: string | null;
  synthetic: boolean;
  quality: EvidenceItem["quality"];
}

/**
 * Normalize a list of raw observations at time `now`.
 * Ids are assigned by deterministic index (`ev_0`, `ev_1`, …) so exact replay
 * reproduces the same evidence set.
 */
export function normalizeEvidence(raw: RawEvidence[], now: string): EvidenceItem[] {
  return raw.map((item, index) => {
    const status =
      item.value === null
        ? "UNAVAILABLE"
        : item.validUntil !== null &&
            item.validUntil !== undefined &&
            item.validUntil <= now
          ? "STALE"
          : "ACTIVE";

    return {
      id: `ev_${index}`,
      type: item.type,
      value: item.value,
      providerId: item.providerId,
      providerType: item.providerType,
      observedAt: item.observedAt ?? now,
      validUntil: item.validUntil ?? null,
      synthetic: item.synthetic,
      quality: item.quality,
      status,
    };
  });
}

/** Convenience: build a synthetic evidence item from a demo override. */
export function overrideEvidence(
  type: EvidenceType,
  value: EvidenceValue,
  _index: number,
  now: string
): RawEvidence {
  return {
    type,
    value,
    providerId: "demo_override",
    providerType: "demo",
    observedAt: now,
    validUntil: null,
    synthetic: true,
    quality: "CONFIRMED",
  };
}
