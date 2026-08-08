/**
 * End-to-end smoke gate (EXECUTION_new2.md §8).
 *
 *   npm run smoke
 *
 * Boots the API on an ephemeral port with a fresh in-memory database, then
 * exercises the full judged path from a fresh demo database:
 *
 *   1. reset demo data
 *   2. create the SIM-swap decision
 *   3. verify SMS OTP is rejected (INELIGIBLE)
 *   4. execute the selected simulated passkey
 *   5. create the phishing decision (same risk, different trust effect)
 *   6. exact-replay the first decision (semantically identical)
 *   7. fork replay with passkey unavailable
 *   8. verify assisted recovery
 *   9. retrieve the decision diff
 *   10. print PASS only when every assertion succeeds
 */
import { fileURLToPath } from "node:url";
import { createApp } from "../apps/api/src/app.js";
import { openDatabase, runMigrations } from "../apps/api/src/db/connection.js";
import { seedDemoData } from "../apps/api/src/db/seed.js";
import { simSwapScenario, phishingScenario, constrainedCapabilityScenario } from "@mfa/demo-data";

const migrationsDir = fileURLToPath(
  new URL("../apps/api/src/db/migrations", import.meta.url)
);

interface Check {
  name: string;
  ok: boolean;
  detail?: string;
}

type JsonBody = Record<string, unknown> | null;

interface DecisionBody extends JsonBody {
  decisionId?: string;
  risk?: { level?: string };
  threats?: { threatId: string; support: string }[];
  trust?: { domainId: string; state: string }[];
  factors?: { factorId: string; status: string; reasonCode?: string; failedRequirements?: { kind: string; reasonCode: string }[] }[];
  selectedFactorId?: string | null;
  action?: string;
  policy?: { version: string; contentHash: string };
  trace?: unknown[];
}

function decisionBody(body: JsonBody): DecisionBody {
  return (body ?? {}) as DecisionBody;
}

async function main(): Promise<number> {
  const db = openDatabase(":memory:");
  runMigrations(db, migrationsDir);
  seedDemoData(db);
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
    return { status: res.status, body };
  }

  try {
    // 1. Reset demo data (deterministic restart).
    const reset = await api("/api/v1/demo/reset", { method: "POST" });
    expect("demo reset", reset.status === 200, `status ${reset.status}`);

    // 2. SIM-swap hero decision (backend scenario preset).
    const sim = await api("/api/v1/decisions", {
      method: "POST",
      body: JSON.stringify(simSwapScenario.build("smoke_sim_001")),
    });
    const simBody = decisionBody(sim.body);
    expect("sim-swap decision created", sim.status === 201, `status ${sim.status}`);
    expect("sim-swap risk HIGH", simBody.risk?.level === "HIGH", JSON.stringify(simBody.risk));
    expect(
      "SIM_CHANNEL_COMPROMISE support STRONG",
      simBody.threats?.find((t) => t.threatId === "SIM_CHANNEL_COMPROMISE")?.support === "STRONG",
      JSON.stringify(simBody.threats)
    );
    expect(
      "SIM_OWNERSHIP DISTRUSTED",
      simBody.trust?.find((t) => t.domainId === "SIM_OWNERSHIP")?.state === "DISTRUSTED",
      JSON.stringify(simBody.trust)
    );

    // 3. SMS OTP rejected for the distrusted SIM dependency.
    const sms = simBody.factors?.find((f) => f.factorId === "SMS_OTP");
    expect(
      "SMS OTP INELIGIBLE (trust requirement)",
      sms?.status === "INELIGIBLE" &&
        sms.failedRequirements?.some((r) => r.kind === "TRUST"),
      JSON.stringify(sms)
    );
    expect(
      "PASSKEY ELIGIBLE + selected",
      simBody.factors?.find((f) => f.factorId === "PASSKEY")?.status === "ELIGIBLE" &&
        simBody.selectedFactorId === "PASSKEY",
      JSON.stringify({ factors: simBody.factors, selected: simBody.selectedFactorId })
    );
    const simId = simBody.decisionId ?? "";
    expect("sim-swap decision id present", simId.length > 0);

    // 4. Execute the selected simulated passkey.
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

    // 5. Phishing hero decision — same risk, different trust effect.
    const phish = await api("/api/v1/decisions", {
      method: "POST",
      body: JSON.stringify(phishingScenario.build("smoke_phish_001")),
    });
    const phishBody = decisionBody(phish.body);
    expect("phishing decision created", phish.status === 201, `status ${phish.status}`);
    expect(
      "equal risk between heroes",
      simBody.risk?.level === phishBody.risk?.level,
      `${simBody.risk?.level} vs ${phishBody.risk?.level}`
    );
    expect(
      "phishing relay: TELECOM_DELIVERY DISTRUSTED, SIM_OWNERSHIP TRUSTED",
      phishBody.trust?.find((t) => t.domainId === "TELECOM_DELIVERY")?.state === "DISTRUSTED" &&
        phishBody.trust?.find((t) => t.domainId === "SIM_OWNERSHIP")?.state === "TRUSTED",
      JSON.stringify(phishBody.trust)
    );

    // 6. Exact replay — determinism proof.
    const exact = await api(`/api/v1/decisions/${simId}/replays`, {
      method: "POST",
      body: JSON.stringify({ mode: "EXACT" }),
    });
    expect("exact replay created", exact.status === 201, JSON.stringify(exact.body));
    const exactId = (exact.body as { replayId?: string })?.replayId ?? "";
    const exactDiff = await api(`/api/v1/replays/${exactId}/diff`);
    expect(
      "exact replay semantically identical",
      exactDiff.status === 200 &&
        (exactDiff.body as { identical?: boolean })?.identical === true,
      JSON.stringify(exactDiff.body)
    );

    // 7. Fork replay: passkey enrolled -> false.
    const fork = await api(`/api/v1/decisions/${simId}/replays`, {
      method: "POST",
      body: JSON.stringify({
        mode: "FORK",
        capabilityChanges: [{ capabilityId: "PASSKEY_ENROLLED", available: false }],
      }),
    });
    expect("fork replay created", fork.status === 201, JSON.stringify(fork.body));
    const forkId = (fork.body as { replayId?: string })?.replayId ?? "";
    const producedId = (fork.body as { producedDecisionId?: string })?.producedDecisionId ?? "";
    const produced = await api(`/api/v1/decisions/${producedId}`);

    // 8. Assisted recovery under the fork.
    const producedBody = decisionBody(produced.body);
    expect(
      "forked passkey UNAVAILABLE",
      producedBody.factors?.find((f) => f.factorId === "PASSKEY")?.status === "UNAVAILABLE",
      JSON.stringify(producedBody.factors)
    );
    expect(
      "forked outcome ASSISTED_RECOVERY",
      producedBody.action === "ASSISTED_RECOVERY" && producedBody.selectedFactorId === null,
      JSON.stringify({ action: producedBody.action, selected: producedBody.selectedFactorId })
    );

    // 9. Decision diff separates derived-state changes; threat/trust unchanged.
    const forkDiff = await api(`/api/v1/replays/${forkId}/diff`);
    const diffBody = forkDiff.body as {
      identical?: boolean;
      sections?: { section: string; changes: unknown[] }[];
    };
    const sections = diffBody.sections?.map((s) => s.section) ?? [];
    expect(
      "fork diff non-identical with FACTOR + SELECTION sections",
      forkDiff.status === 200 &&
        diffBody.identical === false &&
        sections.includes("FACTOR") &&
        sections.includes("SELECTION"),
      JSON.stringify(diffBody)
    );
    expect(
      "fork diff keeps THREAT/TRUST unchanged",
      !sections.includes("THREAT") && !sections.includes("TRUST"),
      JSON.stringify(sections)
    );

    // Verified remediation: constrained user's passkey becomes eligible+selected.
    const recovery = await api("/api/v1/decisions", {
      method: "POST",
      body: JSON.stringify(constrainedCapabilityScenario.build("smoke_con_001")),
    });
    const recoveryBody = decisionBody(recovery.body);
    expect(
      "capability-constrained -> assisted recovery",
      recovery.status === 201 && recoveryBody.action === "ASSISTED_RECOVERY",
      JSON.stringify(recoveryBody)
    );
    const rem = await api(
      `/api/v1/decisions/${recoveryBody.decisionId ?? ""}/remediations/PASSKEY/verify`,
      { method: "POST", body: JSON.stringify({}) }
    );
    expect(
      "verified passkey remediation (would be selected)",
      rem.status === 200 &&
        (rem.body as { wouldBeSelected?: boolean })?.wouldBeSelected === true,
      JSON.stringify(rem.body)
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
  .then((code) => {
    // process.exitCode (not process.exit): on Windows, forcing an immediate
    // exit while undici keep-alive sockets linger trips a libuv assertion.
    process.exitCode = code;
  })
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
