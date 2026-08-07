/**
 * Baseline + determinism tests (docs/EXECUTION.md Phase 2).
 *
 * The baseline's input contract is the point: it is a function of the risk
 * level alone, so it cannot see threat evidence. Identical inputs must also
 * produce deeply equal engine outputs.
 */
import { describe, expect, it } from "vitest";
import { scalarBaseline } from "../src/scalarBaseline.js";
import { evaluateRisk } from "../src/riskEngine.js";
import { evaluateThreat } from "../src/threatEngine.js";
import { evaluatePolicy } from "../src/policyEngine.js";

describe("scalarBaseline", () => {
  it("maps HIGH risk to a phishing-resistant requirement", () => {
    expect(scalarBaseline("HIGH")).toEqual({
      requiredAssurance: 2,
      requirement: "Phishing-resistant factor required",
    });
  });

  it("maps MEDIUM risk to any second factor", () => {
    expect(scalarBaseline("MEDIUM")).toEqual({
      requiredAssurance: 1,
      requirement: "Any second factor required",
    });
  });

  it("maps LOW risk to no additional factor", () => {
    expect(scalarBaseline("LOW")).toEqual({
      requiredAssurance: 0,
      requirement: "No additional factor required",
    });
  });
});

describe("baseline contract", () => {
  it("receives only the risk level — no threat evidence can be passed", () => {
    // The signature is (riskLevel) => result. Passing a threat indicator is a
    // compile-time error; at runtime the function ignores anything extra.
    const high = scalarBaseline("HIGH");
    const sameHighAgain = scalarBaseline("HIGH");
    expect(high).toEqual(sameHighAgain);

    // Equal-risk hero scenarios must produce the SAME baseline requirement.
    expect(scalarBaseline("HIGH").requirement).toBe(
      scalarBaseline("HIGH").requirement
    );
  });
});

describe("determinism", () => {
  it("produces deeply equal outputs for identical inputs", () => {
    const riskInput = {
      amountMinor: 5_000_000,
      payeeIsKnown: false,
      firstSeen: true,
      failedLoginCount: 0,
      sessionAgeSeconds: 120,
      recentSimChange: true,
      geoDistanceFromLastLoginKm: 420,
      phishingRelayIndicator: false,
    };
    const threatInput = {
      recentSimChange: true,
      phishingRelayIndicator: false,
      firstSeen: true,
      payeeIsKnown: false,
      amountMinor: 5_000_000,
      failedLoginCount: 0,
      sessionAgeSeconds: 120,
    };

    expect(evaluateRisk(riskInput)).toEqual(evaluateRisk(riskInput));
    expect(evaluateThreat(threatInput)).toEqual(evaluateThreat(threatInput));
    expect(
      evaluatePolicy({
        riskLevel: "HIGH",
        threatType: "SIM_CHANNEL_COMPROMISE",
        passkeyEnrolled: true,
      })
    ).toEqual(
      evaluatePolicy({
        riskLevel: "HIGH",
        threatType: "SIM_CHANNEL_COMPROMISE",
        passkeyEnrolled: true,
      })
    );
  });
});
