/**
 * WebAuthn tests (docs/EXECUTION_new.md Phase 7).
 *
 * A real authenticator ceremony cannot run in vitest, so these tests pin the
 * enforceable server-side contract: mode selection (WEBAUTHN vs the labeled
 * SIMULATED fallback), origin/RP binding (including at verify time), credential
 * ownership, ceremony expiry/replay, and persistence of public credential data.
 */
import { describe, expect, it, beforeEach } from "vitest";
import request from "supertest";
import { fileURLToPath } from "node:url";
import { createApp } from "../src/app.js";
import { openDatabase, runMigrations, type Db } from "../src/db/connection.js";
import { PasskeyCredentialRepository } from "../src/repositories/passkeyRepository.js";

const migrationsDir = fileURLToPath(new URL("../src/db/migrations", import.meta.url));

const LOCAL_ORIGIN = "http://localhost:5173";

let db: Db;
let api: ReturnType<typeof createApp>;

beforeEach(() => {
  db = openDatabase(":memory:");
  runMigrations(db, migrationsDir);
  api = createApp({ db, demoMode: true });
});

function seedCredential(userId = "user_demo_01", id = "cred_test_001"): void {
  const repo = new PasskeyCredentialRepository(db);
  repo.create({
    id,
    userId,
    // Public demo key material (not a real COSE key — just bytes for the test).
    publicKey: Buffer.from("demo-public-key-bytes", "utf8").toString("base64url"),
    counter: 1,
    transports: ["internal"],
    deviceType: "singleDevice",
    backedUp: false,
    createdAt: new Date().toISOString(),
  });
}

async function createSimSwapDecision(): Promise<string> {
  const res = await request(api).post("/api/v1/decisions").send({
    userId: "user_demo_01",
    transaction: {
      clientTransactionId: `txn_wn_${Date.now()}_${Math.random().toString(36).slice(2)}`,
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
      browserFingerprint: "fp-1",
    },
    signals: {
      recentSimChange: true,
      geoDistanceFromLastLoginKm: null,
      phishingRelayIndicator: false,
    },
  });
  expect(res.status).toBe(201);
  return res.body.decisionId;
}

describe("PASSKEY challenge mode selection (Phase 7)", () => {
  it("falls back to the labeled SIMULATED mode when the user has no credential", async () => {
    const decisionId = await createSimSwapDecision();
    const res = await request(api)
      .post("/api/v1/challenges")
      .set("Origin", LOCAL_ORIGIN)
      .send({ decisionId, factor: "PASSKEY" });
    expect(res.status).toBe(201);
    expect(res.body.mode).toBe("SIMULATED");

    const verify = await request(api)
      .post(`/api/v1/challenges/${res.body.challengeId}/verify`)
      .send({ challengeId: res.body.challengeId, response: { simulatedOk: true } });
    expect(verify.body).toMatchObject({ verified: true, transactionStatus: "AUTHORIZED" });
  });

  it("runs a real WEBAUTHN ceremony when a credential is registered", async () => {
    seedCredential();
    const decisionId = await createSimSwapDecision();
    const res = await request(api)
      .post("/api/v1/challenges")
      .set("Origin", LOCAL_ORIGIN)
      .send({ decisionId, factor: "PASSKEY" });
    expect(res.status).toBe(201);
    expect(res.body.mode).toBe("WEBAUTHN");
    const options = res.body.publicOptions as {
      challenge?: string;
      rpId?: string;
      allowCredentials?: { id: string }[];
    };
    expect(typeof options?.challenge).toBe("string");
    expect(options.rpId).toBe("localhost");
    expect(options.allowCredentials?.map((c) => c.id)).toContain("cred_test_001");
  });

  it("automatically falls back to SIMULATED on a non-secure origin even with a credential", async () => {
    seedCredential();
    const decisionId = await createSimSwapDecision();
    const res = await request(api)
      .post("/api/v1/challenges")
      .set("Origin", "http://192.168.1.20:5173")
      .send({ decisionId, factor: "PASSKEY" });
    expect(res.status).toBe(201);
    expect(res.body.mode).toBe("SIMULATED");
  });

  it("preferSimulated forces the labeled SIMULATED mode in demo mode", async () => {
    seedCredential();
    const decisionId = await createSimSwapDecision();
    const res = await request(api)
      .post("/api/v1/challenges")
      .set("Origin", LOCAL_ORIGIN)
      .send({ decisionId, factor: "PASSKEY", preferSimulated: true });
    expect(res.status).toBe(201);
    expect(res.body.mode).toBe("SIMULATED");

    const verify = await request(api)
      .post(`/api/v1/challenges/${res.body.challengeId}/verify`)
      .send({ challengeId: res.body.challengeId, response: { simulatedOk: true } });
    expect(verify.body).toMatchObject({ verified: true, transactionStatus: "AUTHORIZED" });
  });

  it("rejects preferSimulated outside demo mode", async () => {
    const nonDemo = createApp({ db, demoMode: false });
    const decisionId = await createSimSwapDecision();
    const res = await request(nonDemo)
      .post("/api/v1/challenges")
      .send({ decisionId, factor: "PASSKEY", preferSimulated: true });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });
});

describe("WEBAUTHN challenge verification", () => {
  async function createWebAuthnChallenge(): Promise<{ decisionId: string; challengeId: string }> {
    seedCredential();
    const decisionId = await createSimSwapDecision();
    const res = await request(api)
      .post("/api/v1/challenges")
      .set("Origin", LOCAL_ORIGIN)
      .send({ decisionId, factor: "PASSKEY" });
    expect(res.body.mode).toBe("WEBAUTHN");
    return { decisionId, challengeId: res.body.challengeId };
  }

  function verify(challengeId: string, response: unknown, origin = LOCAL_ORIGIN) {
    return request(api)
      .post(`/api/v1/challenges/${challengeId}/verify`)
      .set("Origin", origin)
      .send({ challengeId, response });
  }

  it("binds the expected origin and RP id into the stored challenge data", async () => {
    const { challengeId } = await createWebAuthnChallenge();
    const row = db
      .prepare("SELECT challenge_data_json FROM challenges WHERE id = ?")
      .get(challengeId) as { challenge_data_json: string };
    const data = JSON.parse(row.challenge_data_json) as {
      webauthn: boolean;
      expectedOrigin: string;
      rpId: string;
      userId: string;
    };
    expect(data.webauthn).toBe(true);
    expect(data.expectedOrigin).toBe(LOCAL_ORIGIN);
    expect(data.rpId).toBe("localhost");
    expect(data.userId).toBe("user_demo_01");
  });

  it("denies a malformed ceremony response and marks the transaction DENIED", async () => {
    const { challengeId } = await createWebAuthnChallenge();
    const res = await verify(challengeId, { id: "cred_test_001", response: {} });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ verified: false, transactionStatus: "DENIED" });
  });

  it("denies a response whose credential is not owned by the challenge user", async () => {
    const { challengeId } = await createWebAuthnChallenge();
    const res = await verify(challengeId, {
      id: "cred_owned_by_someone_else",
      response: {},
    });
    expect(res.status).toBe(200);
    expect(res.body.verified).toBe(false);
  });

  it("rejects verification from an origin different from the issuing origin", async () => {
    const { challengeId } = await createWebAuthnChallenge();
    const res = await verify(challengeId, { id: "cred_test_001", response: {} }, "http://127.0.0.1:5173");
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("CHALLENGE_ERROR");
    expect(String(res.body.error.message)).toContain("different origin");
  });

  it("rejects a replay of a consumed WEBAUTHN challenge", async () => {
    const { challengeId } = await createWebAuthnChallenge();
    await verify(challengeId, { id: "cred_test_001", response: {} });
    const replay = await verify(challengeId, { id: "cred_test_001", response: {} });
    expect(replay.status).toBe(409);
    expect(replay.body.error.code).toBe("CHALLENGE_ERROR");
  });
});

describe("Passkey registration ceremony", () => {
  it("begin registration returns options bound to the request origin", async () => {
    const res = await request(api)
      .post("/api/v1/passkeys/register/options")
      .set("Origin", LOCAL_ORIGIN)
      .send({ userId: "user_demo_01" });
    expect(res.status).toBe(201);
    expect(typeof res.body.ceremonyId).toBe("string");
    const options = res.body.options as {
      rp?: { id: string; name: string };
      user?: { name: string };
      challenge?: string;
      pubKeyCredParams?: unknown[];
    };
    expect(options.rp?.id).toBe("localhost");
    expect(options.rp?.name).toBe("Threat-Aware MFA");
    expect(options.user?.name).toBe("Aarav Nair");
    expect(typeof options.challenge).toBe("string");
    expect((options.pubKeyCredParams ?? []).length).toBeGreaterThan(0);

    // The ceremony is persisted for later verification.
    const row = db
      .prepare("SELECT * FROM passkey_registrations WHERE id = ?")
      .get(res.body.ceremonyId) as { expected_origin: string; consumed_at: string | null };
    expect(row.expected_origin).toBe(LOCAL_ORIGIN);
    expect(row.consumed_at).toBeNull();
  });

  it("rejects a registration ceremony verify with a garbage response", async () => {
    const begin = await request(api)
      .post("/api/v1/passkeys/register/options")
      .send({ userId: "user_demo_01" });
    const res = await request(api)
      .post("/api/v1/passkeys/register/verify")
      .send({ ceremonyId: begin.body.ceremonyId, response: {} });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("CHALLENGE_ERROR");
  });

  it("rejects an expired registration ceremony", async () => {
    const begin = await request(api)
      .post("/api/v1/passkeys/register/options")
      .send({ userId: "user_demo_01" });
    db.prepare("UPDATE passkey_registrations SET expires_at = ? WHERE id = ?").run(
      "2020-01-01T00:00:00.000Z",
      begin.body.ceremonyId
    );
    const res = await request(api)
      .post("/api/v1/passkeys/register/verify")
      .send({ ceremonyId: begin.body.ceremonyId, response: {} });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("CHALLENGE_ERROR");
  });

  it("rejects a consumed registration ceremony", async () => {
    const begin = await request(api)
      .post("/api/v1/passkeys/register/options")
      .send({ userId: "user_demo_01" });
    db.prepare("UPDATE passkey_registrations SET consumed_at = ? WHERE id = ?").run(
      new Date().toISOString(),
      begin.body.ceremonyId
    );
    const res = await request(api)
      .post("/api/v1/passkeys/register/verify")
      .send({ ceremonyId: begin.body.ceremonyId, response: {} });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("CHALLENGE_ERROR");
  });

  it("is disabled outside demo mode", async () => {
    const nonDemo = createApp({ db, demoMode: false });
    const res = await request(nonDemo)
      .post("/api/v1/passkeys/register/options")
      .send({ userId: "user_demo_01" });
    expect(res.status).toBe(403);
  });
});

describe("Passkey credential persistence", () => {
  it("exposes registered credentials through the demo users endpoint", async () => {
    seedCredential();
    const res = await request(api).get("/api/v1/demo/users");
    const aarav = (res.body.users as { id: string; passkeys: { id: string }[] }[]).find(
      (u) => u.id === "user_demo_01"
    );
    expect(aarav?.passkeys.map((c) => c.id)).toContain("cred_test_001");
  });

  it("demo reset clears passkey credentials and ceremonies", async () => {
    seedCredential();
    await request(api).post("/api/v1/passkeys/register/options").send({
      userId: "user_demo_01",
    });
    await request(api).post("/api/v1/demo/reset");
    const res = await request(api).get("/api/v1/demo/users");
    const aarav = (res.body.users as { id: string; passkeys: unknown[] }[]).find(
      (u) => u.id === "user_demo_01"
    );
    expect(aarav?.passkeys).toHaveLength(0);
    const ceremonies = db
      .prepare("SELECT COUNT(*) AS n FROM passkey_registrations")
      .get() as { n: number };
    expect(ceremonies.n).toBe(0);
  });
});
