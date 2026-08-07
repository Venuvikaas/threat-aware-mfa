/**
 * Canonical content hashing (EXECUTION_new2.md §4.7, Phase 2).
 *
 * Bundles are immutable; every decision stores bundle id, version, and
 * content hash, and the hash is verified whenever a bundle is loaded.
 * Serialization is canonical (stable key order) so the hash is independent of
 * insertion order — the same logical bundle always hashes the same.
 */
import { createHash } from "node:crypto";
import type { PolicyBundle } from "@mfa/contracts";

/** Canonically serialize a bundle's *content* (everything except contentHash). */
export function canonicalPolicyJson(bundle: Omit<PolicyBundle, "contentHash">): string {
  // Strip any stored contentHash before serializing so hashing is idempotent.
  const { contentHash: _ignored, ...content } = bundle as PolicyBundle;
  return JSON.stringify(stableClone(content));
}

/** Compute the content hash for a bundle (excluding its own contentHash). */
export function hashPolicy(bundle: Omit<PolicyBundle, "contentHash">): string {
  const digest = createHash("sha256").update(canonicalPolicyJson(bundle)).digest("hex");
  return `sha256:${digest}`;
}

/** Verify a stored bundle's content hash matches its content. */
export function verifyPolicyHash(bundle: PolicyBundle): boolean {
  return bundle.contentHash === hashPolicy(bundle);
}

/** Attach the computed content hash, returning a complete immutable bundle. */
export function withContentHash(bundle: Omit<PolicyBundle, "contentHash">): PolicyBundle {
  return { ...bundle, contentHash: hashPolicy(bundle) };
}

/**
 * Deep-clone with object keys sorted recursively — the canonical form. Arrays
 * keep their order (rules are ordered), object keys are sorted.
 */
function stableClone(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stableClone);
  }
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(record).sort()) {
      sorted[key] = stableClone(record[key]);
    }
    return sorted;
  }
  return value;
}
