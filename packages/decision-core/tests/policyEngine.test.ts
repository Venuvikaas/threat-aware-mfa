/**
 * Policy engine tests (docs/EXECUTION.md Phase 2).
 *
 * Proves the invariants: a blocked or unavailable factor can never be
 * selected; enrollment changes availability, never the threat hypothesis;
 * assisted recovery is the only outcome when no factor survives.
 */
import { describe, expect, it } from "vitest";
import {
  evaluatePolicy,
  type PolicyEvaluation,
} from "../src/policyEngine.js";
import type { FactorDecision } from "@mfa/contracts";

describe("evaluatePolicy — SIM channel compromise", () => {
  it("blocks SMS OTP and selects the enrolled passkey", () => {
    const result = evaluatePolicy({
      riskLevel: "HIGH",
      threatType: "SIM_CHANNEL_COMPROMISE",
      passkeyEnrolled: true,
    });
    const sms = factor(result, "SMS_OTP");
    expect(sms.status).toBe("BLOCKED");
    expect(sms.reasonCode).toBe("sms_channel_untrusted");

    const passkey = factor(result, "PASSKEY");
    expect(passkey.status).toBe("ALLOWED");
    expect(passkey.reasonCode).toBe("factor_eligible");

    expect(result.allowedFactors).toEqual(["PASSKEY"]);
    expect(result.blockedFactors).toEqual(["SMS_OTP"]);
    expect(result.selectedFactor).toBe("PASSKEY");
    expect(result.action).toBe("ALLOW_WITH_FACTOR");
  });

  it("falls back to assisted recovery when the passkey is not enrolled", () => {
    const result = evaluatePolicy({
      riskLevel: "HIGH",
      threatType: "SIM_CHANNEL_COMPROMISE",
      passkeyEnrolled: false,
    });
    expect(factor(result, "PASSKEY").status).toBe("UNAVAILABLE");
    expect(factor(result, "PASSKEY").reasonCode).toBe("passkey_not_enrolled");
    expect(factor(result, "SMS_OTP").status).toBe("BLOCKED");
    expect(result.selectedFactor).toBeNull();
    expect(result.allowedFactors).toEqual([]);
    expect(result.action).toBe("REFER_TO_ASSISTED_RECOVERY");
  });

  it("does not change the threat decision when enrollment toggles", () => {
    const withEnrollment = evaluatePolicy({
      riskLevel: "HIGH",
      threatType: "SIM_CHANNEL_COMPROMISE",
      passkeyEnrolled: true,
    });
    const withoutEnrollment = evaluatePolicy({
      riskLevel: "HIGH",
      threatType: "SIM_CHANNEL_COMPROMISE",
      passkeyEnrolled: false,
    });
    // SMS stays blocked under the hypothesis in both cases.
    expect(factor(withEnrollment, "SMS_OTP").status).toBe("BLOCKED");
    expect(factor(withoutEnrollment, "SMS_OTP").status).toBe("BLOCKED");
  });
});

describe("evaluatePolicy — phishing", () => {
  it("blocks SMS OTP as relayable and selects the enrolled passkey", () => {
    const result = evaluatePolicy({
      riskLevel: "HIGH",
      threatType: "PHISHING",
      passkeyEnrolled: true,
    });
    expect(factor(result, "SMS_OTP")).toMatchObject({
      status: "BLOCKED",
      reasonCode: "factor_relayable",
    });
    expect(result.selectedFactor).toBe("PASSKEY");
  });

  it("produces assisted recovery when no passkey is enrolled", () => {
    const result = evaluatePolicy({
      riskLevel: "HIGH",
      threatType: "PHISHING",
      passkeyEnrolled: false,
    });
    expect(result.action).toBe("REFER_TO_ASSISTED_RECOVERY");
    expect(result.selectedFactor).toBeNull();
  });
});

describe("evaluatePolicy — insufficient evidence", () => {
  it("allows both factors at MEDIUM risk and selects the passkey by preference", () => {
    const result = evaluatePolicy({
      riskLevel: "MEDIUM",
      threatType: "INSUFFICIENT_EVIDENCE",
      passkeyEnrolled: true,
    });
    expect(result.allowedFactors).toEqual(["PASSKEY", "SMS_OTP"]);
    expect(result.selectedFactor).toBe("PASSKEY");
  });

  it("keeps SMS OTP but blocks passkey when unenrolled at MEDIUM risk", () => {
    const result = evaluatePolicy({
      riskLevel: "MEDIUM",
      threatType: "INSUFFICIENT_EVIDENCE",
      passkeyEnrolled: false,
    });
    expect(factor(result, "PASSKEY").status).toBe("UNAVAILABLE");
    expect(factor(result, "SMS_OTP").status).toBe("ALLOWED");
    expect(result.selectedFactor).toBe("SMS_OTP");
  });
});

describe("factor-selection invariants", () => {
  it("never selects a blocked or unavailable factor", () => {
    const cases: {
      riskLevel: "LOW" | "MEDIUM" | "HIGH";
      threatType: "SIM_CHANNEL_COMPROMISE" | "PHISHING" | "INSUFFICIENT_EVIDENCE";
      passkeyEnrolled: boolean;
    }[] = [
      { riskLevel: "HIGH", threatType: "SIM_CHANNEL_COMPROMISE", passkeyEnrolled: true },
      { riskLevel: "HIGH", threatType: "SIM_CHANNEL_COMPROMISE", passkeyEnrolled: false },
      { riskLevel: "HIGH", threatType: "PHISHING", passkeyEnrolled: false },
      { riskLevel: "MEDIUM", threatType: "INSUFFICIENT_EVIDENCE", passkeyEnrolled: false },
      { riskLevel: "HIGH", threatType: "INSUFFICIENT_EVIDENCE", passkeyEnrolled: false },
    ];
    for (const input of cases) {
      const result = evaluatePolicy(input);
      if (result.selectedFactor !== null) {
        const selected = factor(result, result.selectedFactor);
        expect(selected.status, `selected ${result.selectedFactor} must be ALLOWED`).toBe(
          "ALLOWED"
        );
      }
      for (const f of result.factors) {
        if (f.status !== "ALLOWED") {
          expect(result.selectedFactor, `${f.factor} must not be selected`).not.toBe(
            f.factor
          );
        }
      }
    }
  });

  it("selects at most one factor and it is first in preference order", () => {
    const result = evaluatePolicy({
      riskLevel: "LOW",
      threatType: "INSUFFICIENT_EVIDENCE",
      passkeyEnrolled: true,
    });
    const allowed = result.factors.filter((f) => f.status === "ALLOWED");
    expect(allowed.length).toBe(2);
    expect(result.selectedFactor).toBe("PASSKEY");
  });
});

function factor(result: PolicyEvaluation, id: string): FactorDecision {
  const found = result.factors.find((f) => f.factor === id);
  if (!found) throw new Error(`factor ${id} missing`);
  return found;
}
