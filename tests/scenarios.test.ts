import { describe, expect, it } from "vitest";
import { evaluateScenario } from "../src/engine/evaluateScenario";
import { simSwapScenario } from "../src/scenarios/simSwap";
import { demoPolicy } from "../src/policy/demoPolicy";

describe("SIM-swap hero scenario", () => {
  const decision = evaluateScenario(simSwapScenario, demoPolicy);

  it("keeps the documented high aggregate risk", () => {
    expect(simSwapScenario.aggregateRisk).toBe("high");
  });

  it("derives sim_channel_compromise with the policy's explicit support band", () => {
    expect(decision.hypothesis).toBe("sim_channel_compromise");
    expect(decision.supportBand).toBe("high_support");
  });

  it("uses SIM-change evidence and distrusts the SMS channel", () => {
    expect(decision.evidenceUsed).toContain("Recent SIM change");
    expect(decision.doNotTrust).toContain("Phone number (SMS channel)");
  });

  it("excludes SMS OTP and selects passkey when enrolled", () => {
    const sms = decision.factors.find((f) => f.factorId === "sms_otp")!;
    const passkey = decision.factors.find((f) => f.factorId === "passkey")!;

    expect(sms.state).toBe("excluded");
    expect(sms.reasonCode).toBe("SMS_CHANNEL_UNTRUSTED");
    expect(passkey.state).toBe("eligible");
    expect(decision.selectedFactor).toBe("passkey");
    expect(decision.outcome).toBe("factor_selected");
  });

  it("falls back to assisted recovery when passkey enrollment is removed", () => {
    const withoutPasskey = evaluateScenario(
      { ...simSwapScenario, capabilities: { passkeyEnrolled: false } },
      demoPolicy
    );

    expect(withoutPasskey.hypothesis).toBe("sim_channel_compromise");
    expect(withoutPasskey.outcome).toBe("assisted_recovery");
    expect(withoutPasskey.selectedFactor).toBeNull();
  });
});
