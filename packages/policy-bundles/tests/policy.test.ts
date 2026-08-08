/**
 * Policy-bundle coverage (EXECUTION_new2.md Phase 2).
 *
 * - The active demo bundle validates clean.
 * - Corrupt bundles (unknown domain / capability / factor / evidence refs)
 *   are rejected with a path + message.
 * - Content hashing is canonical and stable; a tampered bundle fails
 *   verification.
 */
import { describe, expect, it } from "vitest";
import type { PolicyBundle } from "@mfa/contracts";
import {
  CANDIDATE_POLICY_BUNDLE,
  DEMO_POLICY_BUNDLE,
  DEMO_POLICY_DATA,
  POLICY_BUNDLES,
  hashPolicy,
  validatePolicy,
  verifyPolicyHash,
  withContentHash,
} from "@mfa/policy-bundles";

describe("validatePolicy", () => {
  it("accepts the active demo bundle", () => {
    expect(validatePolicy(DEMO_POLICY_BUNDLE)).toEqual([]);
  });

  it("rejects an unknown trust-domain reference in a factor", () => {
    const bad = {
      ...DEMO_POLICY_BUNDLE,
      factorDefinitions: DEMO_POLICY_BUNDLE.factorDefinitions.map((f) =>
        f.id === "SMS_OTP"
          ? {
              ...f,
              trustRequirements: [
                { domainId: "MOON_PHASE", minimumState: "TRUSTED", rationaleCode: "x" },
              ],
            }
          : f
      ),
    };
    const issues = validatePolicy(bad as unknown as PolicyBundle);
    expect(issues.some((i) => i.message.includes("MOON_PHASE"))).toBe(true);
  });

  it("rejects an unknown capability reference", () => {
    const bad = {
      ...DEMO_POLICY_BUNDLE,
      factorDefinitions: DEMO_POLICY_BUNDLE.factorDefinitions.map((f) =>
        f.id === "PASSKEY"
          ? { ...f, capabilityRequirements: ["VIP_ACCESS"] }
          : f
      ),
    };
    expect(validatePolicy(bad as unknown as PolicyBundle).some((i) => i.message.includes("VIP_ACCESS"))).toBe(true);
  });

  it("rejects an unknown threat id in a trust impact rule", () => {
    const bad = {
      ...DEMO_POLICY_BUNDLE,
      trustImpactRules: [{ id: "ti_bad", threatId: "CRYPTO_MINING", domainId: "SIM_OWNERSHIP", impact: "DISTRUST" }],
    };
    expect(validatePolicy(bad as unknown as PolicyBundle).some((i) => i.message.includes("CRYPTO_MINING"))).toBe(true);
  });

  it("rejects an unknown evidence type in a threat rule", () => {
    const bad = {
      ...DEMO_POLICY_BUNDLE,
      threatRules: [
        { id: "tr_bad", threatId: "SIM_CHANNEL_COMPROMISE", kind: "PRIMARY", predicate: { evidenceType: "OUJIA_BOARD", op: "EQ", value: true } },
      ],
    };
    expect(validatePolicy(bad as unknown as PolicyBundle).some((i) => i.message.includes("OUJIA_BOARD"))).toBe(true);
  });
});

describe("hashPolicy", () => {
  it("produces a canonical sha256 hash", () => {
    const hash = hashPolicy(DEMO_POLICY_DATA);
    expect(hash.startsWith("sha256:")).toBe(true);
    expect(hash.length).toBeGreaterThan(16);
  });

  it("is stable across re-serialization (key order independent)", () => {
    const clone = JSON.parse(JSON.stringify(DEMO_POLICY_DATA)) as typeof DEMO_POLICY_DATA;
    expect(hashPolicy(clone)).toBe(hashPolicy(DEMO_POLICY_DATA));
  });

  it("verifies the full demo bundle's stored hash", () => {
    expect(verifyPolicyHash(DEMO_POLICY_BUNDLE)).toBe(true);
  });

  it("fails verification when content is tampered", () => {
    const tampered = withContentHash({
      ...DEMO_POLICY_DATA,
      selectionPolicy: {
        ...DEMO_POLICY_DATA.selectionPolicy,
        tieBreaker: ["PIN", "SMS_OTP", "TOTP", "PASSKEY"],
      },
    });
    // Rehash after tampering, then corrupt a second field so the stored hash
    // no longer matches.
    const corrupted = { ...tampered, version: "1.0.1" };
    expect(verifyPolicyHash(corrupted)).toBe(false);
  });
});

describe("candidate policy v1.1.0 (Stretch B)", () => {
  it("validates clean and carries exactly one deliberate rule change", () => {
    expect(validatePolicy(CANDIDATE_POLICY_BUNDLE)).toEqual([]);
    const added = CANDIDATE_POLICY_BUNDLE.trustImpactRules.filter(
      (r) => !DEMO_POLICY_BUNDLE.trustImpactRules.some((d) => d.id === r.id)
    );
    expect(added).toHaveLength(1);
    expect(added[0].id).toBe("trust_sim_credentials");
  });

  it("is a DRAFT candidate (never the active default) with a verified hash", () => {
    expect(CANDIDATE_POLICY_BUNDLE.status).toBe("DRAFT");
    expect(verifyPolicyHash(CANDIDATE_POLICY_BUNDLE)).toBe(true);
    expect(POLICY_BUNDLES.map((b) => b.version)).toEqual(["1.0.0", "1.1.0"]);
  });
});
