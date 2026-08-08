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
import type {
  CapabilityOverride,
  CapabilityState,
  EvidenceItem,
  EvidenceOverride,
  EvidenceType,
  EvidenceValue,
} from "@mfa/contracts";

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

/**
 * Apply client-supplied evidence overrides to a normalized evidence set
 * (replay fork, EXECUTION_new2.md §5.4/Phase 6).
 *
 * Pure and deterministic: unchanged items keep their identity and ids;
 * overridden items get the new value with a recomputed status (null is
 * UNAVAILABLE, expired validity is STALE, otherwise ACTIVE); overrides that
 * reference an absent evidence type are appended as synthetic demo
 * observations so the fork still carries the declared signal.
 */
export function applyEvidenceOverrides(
  evidence: EvidenceItem[],
  overrides: EvidenceOverride[],
  now: string
): EvidenceItem[] {
  const items = [...evidence];
  for (const override of overrides) {
    const index = items.findIndex((e) => e.type === override.type);
    if (index >= 0) {
      const existing = items[index];
      items[index] = {
        ...existing,
        value: override.value,
        status: statusFor(override.value, existing.validUntil, now),
      };
    } else {
      items.push({
        id: `ev_${items.length}`,
        type: override.type,
        value: override.value,
        providerId: "demo_override",
        providerType: "demo",
        observedAt: now,
        validUntil: null,
        synthetic: true,
        quality: "CONFIRMED",
        status: statusFor(override.value, null, now),
      });
    }
  }
  return items;
}

function statusFor(value: EvidenceValue, validUntil: string | null, now: string): EvidenceItem["status"] {
  if (value === null) return "UNAVAILABLE";
  if (validUntil !== null && validUntil <= now) return "STALE";
  return "ACTIVE";
}

/** Apply capability overrides (replay fork). Pure; preserves unspecified caps. */
export function applyCapabilityOverrides(
  capabilities: CapabilityState[],
  changes: CapabilityOverride[]
): CapabilityState[] {
  const map = new Map(capabilities.map((c) => [c.capabilityId, c.available]));
  for (const change of changes) {
    map.set(change.capabilityId, change.available);
  }
  return [...map.entries()].map(([capabilityId, available]) => ({ capabilityId, available }));
}
