/**
 * Persistence foundation coverage (EXECUTION_new2.md Phase 2 exit gate).
 *
 * - Fresh migration creates the full decision graph schema.
 * - Seed is idempotent and the active policy bundle is hash-verified.
 * - Repository round trips: decision graph in -> identical response out.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { openDatabase, runMigrations, type Db } from "../src/db/connection.js";
import { seedDemoData } from "../src/db/seed.js";
import { CapabilityRepository } from "../src/repositories/capabilityRepository.js";
import { DecisionRepository } from "../src/repositories/decisionRepository.js";
import { PolicyRepository } from "../src/repositories/policyRepository.js";
import { UserRepository } from "../src/repositories/userRepository.js";
import { evaluateDecision, normalizeEvidence, type RawEvidence } from "@mfa/decision-core";
import { DEMO_POLICY_BUNDLE, verifyPolicyHash } from "@mfa/policy-bundles";
import { simSwapScenario } from "@mfa/demo-data";

const migrationsDir = fileURLToPath(
  new URL("../src/db/migrations", import.meta.url)
);

let db: Db;

beforeAll(() => {
  db = openDatabase(":memory:");
  runMigrations(db, migrationsDir);
  seedDemoData(db);
});

describe("schema + seed", () => {
  it("applies migrations exactly once", () => {
    const applied = runMigrations(db, migrationsDir);
    expect(applied).toEqual([]);
  });

  it("seeds synthetic users and capability profiles", () => {
    const users = new UserRepository(db);
    expect(users.all().map((u) => u.id)).toEqual(["user_demo_01", "user_demo_02"]);
    const caps = new CapabilityRepository(db);
    expect(caps.findByUserId("user_demo_01").find((c) => c.capabilityId === "PASSKEY_ENROLLED")?.available).toBe(true);
    expect(caps.findByUserId("user_demo_02").find((c) => c.capabilityId === "PASSKEY_ENROLLED")?.available).toBe(false);
  });

  it("is idempotent across repeated seeds", () => {
    seedDemoData(db);
    seedDemoData(db);
    const bundles = db.prepare("SELECT COUNT(*) AS n FROM policy_bundles").get() as { n: number };
    expect(bundles.n).toBe(1);
  });

  it("loads the active policy bundle with a verified content hash", () => {
    const repo = new PolicyRepository(db);
    const bundle = repo.findActive();
    expect(bundle?.id).toBe("bundle_demo");
    expect(bundle?.version).toBe("1.0.0");
    expect(verifyPolicyHash(bundle!)).toBe(true);
    expect(bundle?.contentHash).toBe(DEMO_POLICY_BUNDLE.contentHash);
  });
});

describe("decision graph round trip", () => {
  it("persists and reconstructs the full reasoning chain", () => {
    const request = simSwapScenario.build("ct_roundtrip_1");
    const now = "2026-08-07T08:00:00.000Z";
    const raw: RawEvidence[] = (request.evidenceOverrides ?? []).map((o) => ({
      type: o.type,
      value: o.value,
      providerId: "demo_override",
      providerType: "demo",
      observedAt: now,
      validUntil: null,
      synthetic: true,
      quality: "CONFIRMED",
    }));
    const evidence = normalizeEvidence(raw, now);
    const capabilities = new CapabilityRepository(db).findByUserId("user_demo_01");
    const decision = evaluateDecision({ evidence, capabilities, policy: DEMO_POLICY_BUNDLE });

    // The real service creates the transaction before the decision graph.
    db.prepare(
      `INSERT INTO transactions (id, client_transaction_id, user_id, amount_minor, currency, payee_id, payee_is_known, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      "txn_roundtrip",
      "ct_roundtrip_1",
      "user_demo_01",
      5_000_000,
      "INR",
      "payee_new_77",
      0,
      "PENDING",
      now
    );

    const repo = new DecisionRepository(db);
    repo.persist({
      id: "dec_roundtrip",
      transactionId: "txn_roundtrip",
      policyBundleId: DEMO_POLICY_BUNDLE.id,
      policyVersion: DEMO_POLICY_BUNDLE.version,
      contentHash: DEMO_POLICY_BUNDLE.contentHash,
      riskLevel: decision.risk.level,
      riskReasonCodes: decision.risk.reasonCodes,
      action: decision.action,
      selectedFactorId: decision.selectedFactorId,
      evidence,
      threats: decision.threats,
      trust: decision.trust,
      factors: decision.factors,
      trace: decision.trace,
      createdAt: now,
    });

    const restored = repo.findById("dec_roundtrip")!;
    expect(restored.decisionId).toBe("dec_roundtrip");
    expect(restored.policy.contentHash).toBe(DEMO_POLICY_BUNDLE.contentHash);
    expect(restored.risk.level).toBe(decision.risk.level);
    expect(restored.risk.reasonCodes).toEqual(decision.risk.reasonCodes);
    expect(restored.threats).toEqual(decision.threats);
    expect(restored.trust).toEqual(decision.trust);
    expect(restored.factors).toEqual(decision.factors);
    expect(restored.trace).toEqual(decision.trace);
    expect(restored.selectedFactorId).toBe("PASSKEY");
    expect(restored.action).toBe("CHALLENGE");
  });

  it("rejects a corrupt policy hash on load", () => {
    const db2 = openDatabase(":memory:");
    runMigrations(db2, migrationsDir);
    seedDemoData(db2);
    const row = db2.prepare("SELECT rules_json FROM policy_bundles WHERE id = 'bundle_demo'").get() as { rules_json: string };
    const tampered = JSON.parse(row.rules_json);
    tampered.selectionPolicy.tieBreaker = tampered.selectionPolicy.tieBreaker.slice().reverse();
    db2.prepare("UPDATE policy_bundles SET rules_json = ? WHERE id = 'bundle_demo'").run(JSON.stringify(tampered));
    const repo = new PolicyRepository(db2);
    expect(() => repo.findActive()).toThrow(/content-hash verification/);
    db2.close();
  });
});
