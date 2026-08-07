/**
 * Database spine tests (docs/EXECUTION.md Phase 1 exit gate):
 * fresh migration, deterministic seed, repository round trips, foreign keys,
 * and atomic multi-write behavior.
 */
import { describe, expect, it, beforeEach } from "vitest";
import { fileURLToPath } from "node:url";
import { openDatabase, runMigrations, type Db } from "../src/db/connection.js";
import { UserRepository } from "../src/repositories/userRepository.js";
import { DeviceRepository } from "../src/repositories/deviceRepository.js";
import { SessionRepository } from "../src/repositories/sessionRepository.js";
import {
  SignalRepository,
  TransactionRepository,
} from "../src/repositories/transactionRepository.js";
import { DecisionRepository } from "../src/repositories/decisionRepository.js";
import { ChallengeRepository } from "../src/repositories/challengeRepository.js";
import { AuditRepository } from "../src/repositories/auditRepository.js";
import { newId } from "../src/lib/ids.js";

const migrationsDir = fileURLToPath(new URL("../src/db/migrations", import.meta.url));

let db: Db;

beforeEach(() => {
  db = openDatabase(":memory:");
  runMigrations(db, migrationsDir);
});

function tableNames(db: Db): string[] {
  return (
    db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .all() as { name: string }[]
  ).map((r) => r.name);
}

describe("migrations", () => {
  it("creates every minimum table on a fresh database", () => {
    const names = tableNames(db);
    for (const expected of [
      "users",
      "devices",
      "sessions",
      "transactions",
      "signals",
      "decisions",
      "factor_evaluations",
      "challenges",
      "audit_events",
      "schema_migrations",
    ]) {
      expect(names).toContain(expected);
    }
  });

  it("is idempotent — a second run applies nothing", () => {
    expect(runMigrations(db, migrationsDir)).toEqual([]);
  });

  it("enables foreign keys", () => {
    const pragma = db.pragma("foreign_keys", { simple: true });
    expect(pragma).toBe(1);
  });
});

describe("seed", () => {
  it("seeds deterministic synthetic identities", () => {
    const users = new UserRepository(db);
    const devices = new DeviceRepository(db);
    const sessions = new SessionRepository(db);

    const aarav = users.findById("user_demo_01");
    expect(aarav?.name).toBe("Aarav Nair");
    expect(aarav?.passkeyEnrolled).toBe(true);

    const priya = users.findById("user_demo_02");
    expect(priya?.passkeyEnrolled).toBe(false);

    const trusted = devices.findById("dev_trusted_01");
    expect(trusted?.trusted).toBe(true);
    expect(trusted?.userId).toBe("user_demo_01");

    const newDevice = devices.findById("dev_new_01");
    expect(newDevice?.trusted).toBe(false);

    const home = sessions.findById("sess_home_01");
    expect(home?.deviceId).toBe("dev_trusted_01");
    expect(home?.failedLoginCount).toBe(0);

    const unusual = sessions.findById("sess_unusual_01");
    expect(unusual?.failedLoginCount).toBe(2);
  });
});

describe("repository round trips", () => {
  it("persists and retrieves a complete decision trace", () => {
    const transactions = new TransactionRepository(db);
    const signals = new SignalRepository(db);
    const decisions = new DecisionRepository(db);
    const audit = new AuditRepository(db);

    const userId = "user_demo_01";
    const transactionId = newId("txn");
    const decisionId = newId("dec");

    transactions.create({
      id: transactionId,
      clientTransactionId: "txn_client_roundtrip",
      userId,
      amountMinor: 5000000,
      currency: "INR",
      payeeId: "payee_new_77",
      payeeIsKnown: false,
      status: "PENDING",
      createdAt: "2026-08-07T12:00:00.000Z",
    });

    signals.insertMany(transactionId, [
      {
        name: "recent_sim_change",
        value: true,
        source: "mock_telco_adapter",
        synthetic: true,
        observedAt: "2026-08-07T12:00:00.000Z",
      },
    ]);

    decisions.insertDecision({
      id: decisionId,
      transactionId,
      policyVersion: "2026.08.0",
      riskLevel: "HIGH",
      riskReasons: ["high_value_amount", "recent_sim_change"],
      threatType: "SIM_CHANNEL_COMPROMISE",
      threatSupport: "HIGH",
      threatEvidence: ["recent_sim_change", "first_seen_device"],
      allowedFactors: ["PASSKEY"],
      blockedFactors: ["SMS_OTP"],
      selectedFactor: "PASSKEY",
      action: "ALLOW_WITH_FACTOR",
      createdAt: "2026-08-07T12:00:00.100Z",
      factorEvaluations: [
        {
          factor: "PASSKEY",
          status: "ALLOWED",
          reasonCode: "factor_eligible",
          reason: "Enrolled and above required assurance.",
        },
        {
          factor: "SMS_OTP",
          status: "BLOCKED",
          reasonCode: "sim_channel_compromise",
          reason: "SMS channel is not trusted under this hypothesis.",
        },
      ],
    });

    audit.insert({
      decisionId,
      eventType: "DECISION_CREATED",
      reasonCode: "decision_recorded",
      details: { riskLevel: "HIGH", threatType: "SIM_CHANNEL_COMPROMISE" },
      createdAt: "2026-08-07T12:00:00.110Z",
    });
    audit.insert({
      decisionId,
      eventType: "FACTOR_BLOCKED",
      reasonCode: "sim_channel_compromise",
      details: { factor: "SMS_OTP" },
      createdAt: "2026-08-07T12:00:00.120Z",
    });

    const saved = decisions.findById(decisionId);
    expect(saved?.riskLevel).toBe("HIGH");
    expect(saved?.threatType).toBe("SIM_CHANNEL_COMPROMISE");
    expect(saved?.factorEvaluations).toHaveLength(2);
    expect(saved?.blockedFactors).toEqual(["SMS_OTP"]);
    expect(saved?.selectedFactor).toBe("PASSKEY");

    const storedSignals = signals.findByTransactionId(transactionId);
    expect(storedSignals).toHaveLength(1);
    expect(storedSignals[0]).toMatchObject({
      name: "recent_sim_change",
      value: true,
      source: "mock_telco_adapter",
      synthetic: true,
    });

    const events = audit.listByDecision(decisionId);
    expect(events.map((e) => e.eventType)).toEqual([
      "DECISION_CREATED",
      "FACTOR_BLOCKED",
    ]);
  });

  it("enforces the unique client transaction id", () => {
    const transactions = new TransactionRepository(db);
    const base = {
      id: newId("txn"),
      userId: "user_demo_01",
      amountMinor: 1000,
      currency: "INR" as const,
      payeeId: "p1",
      payeeIsKnown: false,
      status: "PENDING" as const,
      createdAt: "2026-08-07T12:00:00.000Z",
    };
    transactions.create({ ...base, clientTransactionId: "dup_client_txn" });
    expect(() =>
      transactions.create({
        ...base,
        id: newId("txn"),
        clientTransactionId: "dup_client_txn",
      })
    ).toThrow(/UNIQUE constraint failed/);
  });

  it("only allows a challenge to be consumed once", () => {
    const transactions = new TransactionRepository(db);
    const decisions = new DecisionRepository(db);
    const challenges = new ChallengeRepository(db);

    const transactionId = newId("txn");
    const decisionId = newId("dec");
    transactions.create({
      id: transactionId,
      clientTransactionId: "txn_client_challenge",
      userId: "user_demo_01",
      amountMinor: 1000,
      currency: "INR",
      payeeId: "p1",
      payeeIsKnown: false,
      status: "PENDING",
      createdAt: "2026-08-07T12:00:00.000Z",
    });
    decisions.insertDecision({
      id: decisionId,
      transactionId,
      policyVersion: "2026.08.0",
      riskLevel: "MEDIUM",
      riskReasons: [],
      threatType: "INSUFFICIENT_EVIDENCE",
      threatSupport: "INSUFFICIENT",
      threatEvidence: [],
      allowedFactors: ["PASSKEY", "SMS_OTP"],
      blockedFactors: [],
      selectedFactor: "PASSKEY",
      action: "ALLOW_WITH_FACTOR",
      createdAt: "2026-08-07T12:00:00.000Z",
      factorEvaluations: [],
    });
    challenges.create({
      id: "ch_0001",
      decisionId,
      factor: "PASSKEY",
      mode: "SIMULATED",
      challengeData: { nonce: "n" },
      expiresAt: "2026-08-07T12:05:00.000Z",
      consumedAt: null,
      verified: false,
      createdAt: "2026-08-07T12:00:00.000Z",
    });
    expect(challenges.consume("ch_0001", true, "2026-08-07T12:00:01.000Z")).toBe(true);
    expect(challenges.consume("ch_0001", true, "2026-08-07T12:00:02.000Z")).toBe(false);
  });
});

describe("foreign keys", () => {
  it("rejects a device for an unknown user", () => {
    const devices = new DeviceRepository(db);
    expect(() =>
      devices.create({
        id: newId("dev"),
        userId: "user_missing",
        trusted: false,
        browserFingerprint: "fp",
        firstSeenAt: "2026-08-07T00:00:00.000Z",
        lastSeenAt: "2026-08-07T00:00:00.000Z",
      })
    ).toThrow(/FOREIGN KEY constraint failed/);
  });

  it("rejects a decision for an unknown transaction", () => {
    const decisions = new DecisionRepository(db);
    expect(() =>
      decisions.insertDecision({
        id: newId("dec"),
        transactionId: "txn_missing",
        policyVersion: "2026.08.0",
        riskLevel: "LOW",
        riskReasons: [],
        threatType: "INSUFFICIENT_EVIDENCE",
        threatSupport: "INSUFFICIENT",
        threatEvidence: [],
        allowedFactors: [],
        blockedFactors: [],
        selectedFactor: null,
        action: "REFER_TO_ASSISTED_RECOVERY",
        createdAt: "2026-08-07T12:00:00.000Z",
        factorEvaluations: [],
      })
    ).toThrow(/FOREIGN KEY constraint failed/);
  });
});

describe("atomic multi-write", () => {
  it("rolls back every insert when the transaction function throws", () => {
    const transactions = new TransactionRepository(db);
    const decisions = new DecisionRepository(db);

    const attempt = db.transaction(() => {
      const transactionId = newId("txn");
      transactions.create({
        id: transactionId,
        clientTransactionId: "txn_atomic_rollback",
        userId: "user_demo_01",
        amountMinor: 1000,
        currency: "INR",
        payeeId: "p1",
        payeeIsKnown: false,
        status: "PENDING",
        createdAt: "2026-08-07T12:00:00.000Z",
      });
      decisions.insertDecision({
        id: newId("dec"),
        transactionId,
        policyVersion: "2026.08.0",
        riskLevel: "LOW",
        riskReasons: [],
        threatType: "INSUFFICIENT_EVIDENCE",
        threatSupport: "INSUFFICIENT",
        threatEvidence: [],
        allowedFactors: [],
        blockedFactors: [],
        selectedFactor: null,
        action: "REFER_TO_ASSISTED_RECOVERY",
        createdAt: "2026-08-07T12:00:00.000Z",
        factorEvaluations: [],
      });
      throw new Error("boom");
    });

    expect(() => attempt()).toThrow("boom");
    expect(transactions.findByClientTransactionId("txn_atomic_rollback")).toBeUndefined();
    expect(
      (db.prepare("SELECT COUNT(*) AS c FROM transactions").get() as { c: number }).c
    ).toBe(0);
  });
});
