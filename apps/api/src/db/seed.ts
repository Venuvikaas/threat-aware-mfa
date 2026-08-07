/**
 * Code-based deterministic seed (EXECUTION_new2.md Phase 2).
 *
 * The policy bundle is seeded from the declarative package (not raw SQL) so
 * the stored content hash always matches the canonical hash of the bundle —
 * a hash written by hand in SQL could silently diverge. Idempotent: running
 * twice does nothing.
 */
import { assertValidPolicy, DEMO_POLICY_BUNDLE } from "@mfa/policy-bundles";
import type { Db } from "./connection.js";

export function seedDemoData(db: Db): void {
  const existing = db.prepare("SELECT id FROM policy_bundles WHERE id = ?").get(DEMO_POLICY_BUNDLE.id);
  if (existing) return;

  assertValidPolicy(DEMO_POLICY_BUNDLE);

  const insertBundle = db.transaction(() => {
    db.prepare(
      `INSERT INTO policy_bundles (id, version, content_hash, status, rules_json, created_at)
       VALUES (@id, @version, @contentHash, @status, @rulesJson, @createdAt)`
    ).run({
      id: DEMO_POLICY_BUNDLE.id,
      version: DEMO_POLICY_BUNDLE.version,
      contentHash: DEMO_POLICY_BUNDLE.contentHash,
      status: DEMO_POLICY_BUNDLE.status,
      rulesJson: JSON.stringify(DEMO_POLICY_BUNDLE),
      createdAt: DEMO_POLICY_BUNDLE.createdAt,
    });

    const insertRule = db.prepare(
      `INSERT INTO policy_rules (bundle_id, rule_type, rule_id, rule_json)
       VALUES (?, ?, ?, ?)`
    );
    for (const rule of DEMO_POLICY_BUNDLE.riskRules) {
      insertRule.run(DEMO_POLICY_BUNDLE.id, "RISK", rule.id, JSON.stringify(rule));
    }
    for (const rule of DEMO_POLICY_BUNDLE.threatRules) {
      insertRule.run(DEMO_POLICY_BUNDLE.id, "THREAT", rule.id, JSON.stringify(rule));
    }
    for (const rule of DEMO_POLICY_BUNDLE.trustImpactRules) {
      insertRule.run(DEMO_POLICY_BUNDLE.id, "TRUST_IMPACT", rule.id, JSON.stringify(rule));
    }
  });

  insertBundle();
}
