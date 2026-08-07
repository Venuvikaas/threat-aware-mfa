import { describe, expect, it } from "vitest";
import { evaluateScenario } from "../src/engine/evaluateScenario";
import type { Scenario } from "../src/engine/types";
import { demoPolicy } from "../src/policy/demoPolicy";

function makeScenario(
  overrides: Partial<Scenario["indicators"]> = {},
  capabilities: Scenario["capabilities"] = { passkeyEnrolled: true }
): Scenario {
  return {
    id: "test-scenario",
    title: "Test scenario",
    aggregateRisk: "high",
    requiredAssurance: 2,
    transaction: { amount: 12500, currency: "INR", payeeType: "new" },
    indicators: {
      recentSimChange: false,
      phishingRelayIndicator: false,
      newDevice: false,
      unusualSession: false,
      newPayee: false,
      ...overrides,
    },
    capabilities,
  };
}

describe("factor-selection invariants", () => {
  it("never selects a threat-incompatible factor (SIM swap)", () => {
    const decision = evaluateScenario(
      makeScenario({ recentSimChange: true, newDevice: true }),
      demoPolicy
    );

    const sms = decision.factors.find((f) => f.factorId === "sms_otp")!;
    expect(sms.state).toBe("excluded");
    expect(decision.selectedFactor).toBe("passkey");
  });

  it("never selects a threat-incompatible factor (phishing)", () => {
    const decision = evaluateScenario(
      makeScenario({ phishingRelayIndicator: true, unusualSession: true }),
      demoPolicy
    );

    const sms = decision.factors.find((f) => f.factorId === "sms_otp")!;
    expect(sms.state).toBe("excluded");
    expect(decision.selectedFactor).toBe("passkey");
  });

  it("never selects an unavailable factor (passkey not enrolled)", () => {
    const decision = evaluateScenario(
      makeScenario({ recentSimChange: true, newDevice: true }, {
        passkeyEnrolled: false,
      }),
      demoPolicy
    );

    const passkey = decision.factors.find((f) => f.factorId === "passkey")!;
    expect(passkey.state).toBe("unavailable");
    expect(passkey.reasonCode).toBe("PASSKEY_NOT_ENROLLED");
    expect(decision.selectedFactor).toBeNull();
    expect(decision.outcome).toBe("assisted_recovery");
  });

  it("never selects a below-assurance factor", () => {
    const decision = evaluateScenario(
      makeScenario({ newDevice: true }),
      demoPolicy
    );

    const sms = decision.factors.find((f) => f.factorId === "sms_otp")!;
    // SMS is below the required phishing-resistant assurance.
    expect(sms.state).toBe("excluded");
    expect(sms.reasonCode).toBe("ASSURANCE_TOO_LOW");
    expect(decision.selectedFactor).toBe("passkey");
  });

  it("gives every factor exactly one state and one reason object", () => {
    const decision = evaluateScenario(
      makeScenario({ recentSimChange: true, newDevice: true }),
      demoPolicy
    );

    expect(decision.factors).toHaveLength(2);
    for (const factor of decision.factors) {
      expect(["eligible", "excluded", "unavailable"]).toContain(factor.state);
      expect(factor.reasonCode).toBeTruthy();
      expect(factor.reason).toBeTruthy();
    }
  });

  it("changes outcome to assisted recovery without changing the hypothesis when passkey enrollment is removed", () => {
    const enrolled = evaluateScenario(
      makeScenario({ recentSimChange: true, newDevice: true }),
      demoPolicy
    );
    const notEnrolled = evaluateScenario(
      makeScenario({ recentSimChange: true, newDevice: true }, {
        passkeyEnrolled: false,
      }),
      demoPolicy
    );

    expect(notEnrolled.hypothesis).toBe(enrolled.hypothesis);
    expect(notEnrolled.hypothesis).toBe("sim_channel_compromise");
    expect(enrolled.outcome).toBe("factor_selected");
    expect(notEnrolled.outcome).toBe("assisted_recovery");
    expect(notEnrolled.selectedFactor).toBeNull();
  });
});
