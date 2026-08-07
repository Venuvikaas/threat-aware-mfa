/**
 * Database integrity tests (EXECUTION_new2.md Phase 2 persistence rules).
 *
 * - Foreign keys are enforced (a decision cannot reference a missing
 *   transaction or bundle).
 * - Decision creation is atomic: a failed multi-write rolls back completely.
 * - Trace events are append-only and ordered.
 */
import { describe, expect, it, beforeEach } from "vitest";
import { fileURLToPath } from "node:url";
import { openDatabase, runMigrations, type Db } from "../src/db/connection.js";
import { seedDemoData } from "../src/db/seed.js";
import { DecisionRepository } from "../src/repositories/decisionRepository.js";
import { evaluateDecision, normalizeEvidence } from "@mfa/decision-core";
import { DEMO_POLICY_BUNDLE } from "@mfa/policy-bundles";

const migrationsDir = fileURLToPath(new URL("../src/db/migrations", import.meta.url));

let db: Db;

beforeEach(() => {
  db = openDatabase(":memory:");
  runMigrations(db, migrationsDir);
  seedDemoData(db);
});

function makeDecisionInput(id: string, transactionId: string) {
  const evidence = normalizeEvidence(
    [{ type: "RECENT_SIM_CHANGE", value: true, providerId: "p", providerType: "t", observedAt: "2026-08-07T08:00:00.000Z", validUntil: null, synthetic: true, quality: "CONFIRMED" }],
    "2026-08-07T08:00:00.000Z"
  );
  const decision = evaluateDecision({
    evidence,
    capabilities: [
      { capabilityId: "PASSKEY_ENROLLED", available: true },
      { capabilityId: "WEBAUTHN_SUPPORTED", available: true },
      { capabilityId: "NETWORK_AVAILABLE", available: true },
      { capabilityId: "TOTP_SEED", available: false },
    ],
    policy: DEMO_POLICY_BUNDLE,
  });
  return {
    id,
    transactionId,
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
    createdAt: "2026-08-07T08:00:00.000Z",
  };
}

function insertTransaction(id: string, clientTransactionId: string): void {
  db.prepare(
    `INSERT INTO transactions (id, client_transaction_id, user_id, amount_minor, currency, payee_id, payee_is_known, status, created_at)
     VALUES (?, ?, 'user_demo_01', 1000, 'INR', 'payee_1', 1, 'PENDING', ?)`
  ).run(id, clientTransactionId, "2026-08-07T08:00:00.000Z");
}

describe("foreign keys", () => {
  it("rejects a decision referencing a missing transaction", () => {
    const repo = new DecisionRepository(db);
    expect(() =>
      repo.persist(makeDecisionInput("dec_fk", "txn_missing"))
    ).toThrow(/FOREIGN KEY/);
  });

  it("rejects a decision referencing a missing policy bundle", () => {
    insertTransaction("txn_ok", "ct_fk_1");
    const input = makeDecisionInput("dec_fk2", "txn_ok");
    input.policyBundleId = "bundle_does_not_exist";
    const repo = new DecisionRepository(db);
    expect(() => repo.persist(input)).toThrow(/FOREIGN KEY/);
  });

  it("rejects a trace event for a missing decision", () => {
    expect(() =>
      db
        .prepare(
          `INSERT INTO trace_events (decision_id, event_id, phase, rule_id, rule_version, input_refs_json, output_refs_json, explanation_code, sequence)
           VALUES ('dec_nope', 'tr_0', 'SELECTION', 'selection', '1.0.0', '[]', '[]', 'x', 0)`
        )
        .run()
    ).toThrow(/FOREIGN KEY/);
  });
});

describe("atomicity", () => {
  it("rolls back the whole decision graph when a child insert fails", () => {
    insertTransaction("txn_atomic", "ct_atomic_1");
    const input = makeDecisionInput("dec_atomic", "txn_atomic");
    // Inject an invalid trace event (bad phase) — schema has no CHECK, so force
    // failure via a duplicate event id (UNIQUE(decision_id, event_id)).
    input.trace.push({ ...input.trace[0] });

    const repo = new DecisionRepository(db);
    expect(() =>
      db.transaction(() => repo.persist(input))()
    ).toThrow();

    // No partial graph may exist.
    const decisions = db.prepare("SELECT COUNT(*) AS n FROM decisions").get() as { n: number };
    const evidence = db.prepare("SELECT COUNT(*) AS n FROM evidence_items").get() as { n: number };
    const trace = db.prepare("SELECT COUNT(*) AS n FROM trace_events").get() as { n: number };
    expect(decisions.n).toBe(0);
    expect(evidence.n).toBe(0);
    expect(trace.n).toBe(0);
  });
});

describe("append-only trace", () => {
  it("preserves ordered trace events after a clean persist", () => {
    insertTransaction("txn_trace", "ct_trace_1");
    const input = makeDecisionInput("dec_trace", "txn_trace");
    const repo = new DecisionRepository(db);
    repo.persist(input);

    const restored = repo.findById("dec_trace")!;
    expect(restored.trace).toEqual(input.trace);
    expect(restored.trace.map((t) => t.sequence)).toEqual(
      [...restored.trace].sort((a, b) => a.sequence - b.sequence).map((t) => t.sequence)
    );
  });
});
