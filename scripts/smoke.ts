/**
 * End-to-end smoke script (docs/EXECUTION.md Phase 8).
 *
 *   npm run smoke
 *
 * Boots the API on an ephemeral port with a fresh in-memory database, then
 * exercises the full judged path: reset → SIM-swap decision → phishing
 * decision → persisted audits → blocked-factor challenge rejection → simulated
 * passkey execution → assisted recovery. Prints PASS or FAIL and exits
 * non-zero on any failure.
 */
import { fileURLToPath } from "node:url";
import { createApp } from "../apps/api/src/app.js";
import { openDatabase, runMigrations } from "../apps/api/src/db/connection.js";
import type { CreateDecisionRequest } from "@mfa/contracts";

const migrationsDir = fileURLToPath(
  new URL("../apps/api/src/db/migrations", import.meta.url)
);

interface Check {
  name: string;
  ok: boolean;
  detail?: string;
}

type JsonBody = Record<string, unknown> | null;

function simSwapRequest(clientTransactionId: string, userId = "user_demo_01"): CreateDecisionRequest {
  return {
    userId,
    transaction: {
      clientTransactionId,
      amountMinor: 5_000_000,
      currency: "INR",
      payeeId: "payee_new_77",
      payeeIsKnown: false,
    },
    session: {
      sessionId: "sess_unusual_01",
      ageSeconds: 120,
      failedLoginCount: 2,
      ipAddress: "198.51.100.44",
      asn: "AS16509",
      country: "US",
    },
    device: {
      deviceId: "dev_new_01",
      trusted: false,
      firstSeen: true,
      browserFingerprint: "fp-unregistered-mobile-42c1",
    },
    signals: {
      recentSimChange: true,
      geoDistanceFromLastLoginKm: null,
      phishingRelayIndicator: false,
    },
  };
}

function phishingRequest(clientTransactionId: string): CreateDecisionRequest {
  return {
    userId: "user_demo_01",
    transaction: {
      clientTransactionId,
      amountMinor: 5_000_000,
      currency: "INR",
      payeeId: "payee_new_88",
      payeeIsKnown: false,
    },
    session: {
      sessionId: "sess_unusual_02",
      ageSeconds: 60,
      failedLoginCount: 2,
      ipAddress: "203.0.113.9",
      asn: "AS14061",
      country: "IN",
    },
    device: {
      deviceId: "dev_trusted_01",
      trusted: true,
      firstSeen: false,
      browserFingerprint: "fp-home-chrome-win-7a9f",
    },
    signals: {
      recentSimChange: null,
      geoDistanceFromLastLoginKm: null,
      phishingRelayIndicator: true,
    },
  };
}

interface DecisionBody extends JsonBody {
  decisionId?: string;
  risk?: { level?: string };
  threat?: { type?: string };
  factors?: { factor: string; status?: string; reasonCode?: string }[];
  selectedFactor?: string | null;
  action?: string;
  error?: { code?: string };
}

async function main(): Promise<number> {
  const db = openDatabase(":memory:");
  runMigrations(db, migrationsDir);
  const app = createApp({ db, demoMode: true });
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", () => resolve()));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("no port");
  const base = `http://localhost:${address.port}`;

  const checks: Check[] = [];
  let failed = false;
  const expect = (name: string, ok: boolean, detail?: string) => {
    checks.push({ name, ok, detail });
    if (!ok) failed = true;
  };

  async function api(path: string, init?: RequestInit) {
    const res = await fetch(`${base}${path}`, {
      headers: { "Content-Type": "application/json" },
      ...init,
    });
    let body: JsonBody = null;
    try {
      body = (await res.json()) as JsonBody;
    } catch {
      // non-JSON body
    }
    return { status: res.status, body: body as DecisionBody | JsonBody };
  }

  try {
    const reset = await api("/api/v1/demo/reset", { method: "POST" });
    expect("demo reset", reset.status === 200, `status ${reset.status}`);

    // SIM-swap hero decision.
    const sim = (await api("/api/v1/decisions", {
      method: "POST",
      body: JSON.stringify(simSwapRequest("smoke_sim_001")),
    })) as { status: number; body: DecisionBody };
    expect("sim-swap decision created", sim.status === 201, `status ${sim.status}`);
    expect("sim-swap risk HIGH", sim.body.risk?.level === "HIGH", JSON.stringify(sim.body.risk));
    expect(
      "sim-swap threat SIM_CHANNEL_COMPROMISE",
      sim.body.threat?.type === "SIM_CHANNEL_COMPROMISE",
      JSON.stringify(sim.body.threat)
    );
    const simSms = sim.body.factors?.find((f) => f.factor === "SMS_OTP");
    expect(
      "SMS OTP blocked (sms_channel_untrusted)",
      simSms?.status === "BLOCKED" && simSms?.reasonCode === "sms_channel_untrusted",
      JSON.stringify(simSms)
    );
    expect(
      "passkey allowed",
      sim.body.factors?.find((f) => f.factor === "PASSKEY")?.status === "ALLOWED"
    );
    expect("selected PASSKEY", sim.body.selectedFactor === "PASSKEY");
    const simId = sim.body.decisionId ?? "";
    expect("sim-swap decision id present", simId.length > 0);

    // Phishing hero decision.
    const phish = (await api("/api/v1/decisions", {
      method: "POST",
      body: JSON.stringify(phishingRequest("smoke_phish_001")),
    })) as { status: number; body: DecisionBody };
    expect("phishing decision created", phish.status === 201, `status ${phish.status}`);
    expect(
      "phishing threat + relayable reason",
      phish.body.threat?.type === "PHISHING" &&
        phish.body.factors?.find((f) => f.factor === "SMS_OTP")?.reasonCode === "factor_relayable",
      JSON.stringify(phish.body.threat)
    );
    expect("equal risk between heroes", sim.body.risk?.level === phish.body.risk?.level);

    // Persisted audit trail.
    if (simId) {
      const audit = await api(`/api/v1/decisions/${simId}/audit`);
      const types = (audit.body as unknown as { eventType: string }[])?.map((e) => e.eventType);
      expect("audit starts with DECISION_CREATED", types?.[0] === "DECISION_CREATED", JSON.stringify(types));
      expect("audit ends with FACTOR_SELECTED", types?.[types.length - 1] === "FACTOR_SELECTED", JSON.stringify(types));
      const auditCheck = await api(`/api/v1/decisions/${simId}/audit`);
      expect("audit stable across fetches", JSON.stringify(audit.body) === JSON.stringify(auditCheck.body));

      // Wow moment: blocked factor cannot create a challenge.
      const smsChallenge = await api("/api/v1/challenges", {
        method: "POST",
        body: JSON.stringify({ decisionId: simId, factor: "SMS_OTP" }),
      });
      expect(
        "SMS challenge rejected with POLICY_REJECTION",
        smsChallenge.status === 409 &&
          (smsChallenge.body as { error?: { code?: string } })?.error?.code === "POLICY_REJECTION",
        JSON.stringify(smsChallenge.body)
      );

      // Selected factor executes through the adapter.
      const pk = await api("/api/v1/challenges", {
        method: "POST",
        body: JSON.stringify({ decisionId: simId, factor: "PASSKEY" }),
      });
      expect("passkey challenge created (SIMULATED)", pk.status === 201, JSON.stringify(pk.body));
      const pkId = (pk.body as { challengeId?: string })?.challengeId ?? "";
      if (pkId) {
        const verify = await api(`/api/v1/challenges/${pkId}/verify`, {
          method: "POST",
          body: JSON.stringify({ challengeId: pkId, response: { simulatedOk: true } }),
        });
        const v = verify.body as { verified?: boolean; transactionStatus?: string };
        expect(
          "passkey verification AUTHORIZED",
          v.verified === true && v.transactionStatus === "AUTHORIZED",
          JSON.stringify(verify.body)
        );
      } else {
        expect("passkey challenge id present", false, JSON.stringify(pk.body));
      }
    }

    // Assisted recovery when no factor survives.
    const recovery = (await api("/api/v1/decisions", {
      method: "POST",
      body: JSON.stringify(simSwapRequest("smoke_recovery_001", "user_demo_02")),
    })) as { status: number; body: DecisionBody };
    expect(
      "unenrolled passkey → assisted recovery",
      recovery.status === 201 &&
        recovery.body.action === "REFER_TO_ASSISTED_RECOVERY" &&
        recovery.body.selectedFactor === null,
      JSON.stringify(recovery.body)
    );
  } catch (err) {
    failed = true;
    checks.push({ name: "unexpected error", ok: false, detail: err instanceof Error ? err.message : String(err) });
  } finally {
    server.close();
    db.close();
  }

  const width = Math.max(...checks.map((c) => c.name.length));
  for (const c of checks) {
    console.log(`${c.ok ? "PASS" : "FAIL"}  ${c.name.padEnd(width)}${c.detail ? `  (${c.detail})` : ""}`);
  }
  console.log(failed ? "\nSMOKE: FAIL" : "\nSMOKE: PASS");
  return failed ? 1 : 0;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
