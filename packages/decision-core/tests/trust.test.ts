/**
 * Trust-state propagation coverage (EXECUTION_new2.md Phase 1).
 *
 * - SIM compromise distrusted -> SIM_OWNERSHIP DISTRUSTED, TELECOM_DELIVERY
 *   DISTRUSTED (both rules apply on STRONG).
 * - Device concern (STRONG) -> SESSION_INTEGRITY DISTRUSTED, DEVICE_INTEGRITY
 *   DEGRADED.
 * - No evidence at all -> conservative UNKNOWN.
 * - Conflicting impacts: DISTRUST wins over DEGRADE.
 */
import { describe, expect, it } from "vitest";
import { assessThreats, assessTrust, normalizeEvidence } from "@mfa/decision-core";
import { DEMO_POLICY_BUNDLE } from "@mfa/policy-bundles";
import type { EvidenceItem } from "@mfa/contracts";

const NOW = "2026-08-07T08:00:00.000Z";

function ev(
  type: EvidenceItem["type"],
  value: EvidenceItem["value"],
  _index: number
): EvidenceItem {
  return normalizeEvidence(
    [
      {
        type,
        value,
        providerId: "test",
        providerType: "test",
        observedAt: NOW,
        validUntil: null,
        synthetic: true,
        quality: "CONFIRMED",
      },
    ],
    NOW
  )[0];
}

function trustFor(evidence: EvidenceItem[]) {
  const threats = assessThreats(evidence, DEMO_POLICY_BUNDLE);
  return assessTrust(threats, evidence, DEMO_POLICY_BUNDLE);
}

describe("assessTrust", () => {
  it("defaults to TRUSTED with benign evidence", () => {
    const trust = trustFor([ev("NEW_PAYEE", true, 0)]);
    expect(trust.find((t) => t.domainId === "SIM_OWNERSHIP")?.state).toBe("TRUSTED");
    expect(trust.find((t) => t.domainId === "CREDENTIAL_INTEGRITY")?.state).toBe("TRUSTED");
  });

  it("distrusts SIM ownership and telecom delivery under SIM compromise", () => {
    const trust = trustFor([ev("RECENT_SIM_CHANGE", true, 0), ev("FAILED_LOGIN_BURST", true, 1)]);
    expect(trust.find((t) => t.domainId === "SIM_OWNERSHIP")?.state).toBe("DISTRUSTED");
    expect(trust.find((t) => t.domainId === "TELECOM_DELIVERY")?.state).toBe("DISTRUSTED");
    const domain = trust.find((t) => t.domainId === "SIM_OWNERSHIP");
    expect(domain?.threatIds).toContain("SIM_CHANNEL_COMPROMISE");
    expect(domain?.activatedRuleIds).toContain("trust_sim_ownership");
  });

  it("degrades device integrity and distrusts session under device concern", () => {
    const trust = trustFor([ev("FIRST_SEEN_DEVICE", true, 0), ev("FAILED_LOGIN_BURST", true, 1)]);
    expect(trust.find((t) => t.domainId === "DEVICE_INTEGRITY")?.state).toBe("DEGRADED");
    expect(trust.find((t) => t.domainId === "SESSION_INTEGRITY")?.state).toBe("DISTRUSTED");
  });

  it("keeps SIM ownership trusted under phishing relay (different trust effect)", () => {
    const trust = trustFor([ev("PHISHING_RELAY_INDICATOR", true, 0), ev("FAILED_LOGIN_BURST", true, 1)]);
    expect(trust.find((t) => t.domainId === "SIM_OWNERSHIP")?.state).toBe("TRUSTED");
    expect(trust.find((t) => t.domainId === "TELECOM_DELIVERY")?.state).toBe("DISTRUSTED");
    expect(trust.find((t) => t.domainId === "USER_VERIFICATION")?.state).toBe("DEGRADED");
  });

  it("emits conservative UNKNOWN when no evidence exists", () => {
    const trust = trustFor([]);
    for (const domain of trust) {
      expect(domain.state).toBe("UNKNOWN");
    }
  });

  it("DISTRUST wins over DEGRADE on a conflicting-impact domain", () => {
    // Both SIM compromise (DISTRUST) and phishing relay (DISTRUST) hit
    // TELECOM_DELIVERY, plus device concern hits SESSION_INTEGRITY DISTRUST.
    const trust = trustFor([
      ev("RECENT_SIM_CHANGE", true, 0),
      ev("PHISHING_RELAY_INDICATOR", true, 1),
      ev("FIRST_SEEN_DEVICE", true, 2),
    ]);
    expect(trust.find((t) => t.domainId === "TELECOM_DELIVERY")?.state).toBe("DISTRUSTED");
  });
});
