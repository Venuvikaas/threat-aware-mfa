/**
 * Code-based deterministic seed (EXECUTION_new2.md Phase 2).
 *
 * The policy bundle is seeded from the declarative package (not raw SQL) so
 * the stored content hash always matches the canonical hash of the bundle —
 * a hash written by hand in SQL could silently diverge. Idempotent: running
 * twice does nothing.
 */
import { assertValidPolicy, POLICY_BUNDLES } from "@mfa/policy-bundles";
import type { Db } from "./connection.js";

export function seedDemoData(db: Db): void {
  // Idempotent: seed every bundle version from the declarative package so
  // stored content hashes always match canonical serialization. The active
  // v1.0.0 stays the default; the DRAFT candidate v1.1.0 (Stretch B) is also
  // seeded so policy-version replay can target it.
  const insertBundle = db.transaction(() => {
    const insertPolicy = db.prepare(
      `INSERT INTO policy_bundles (id, version, content_hash, status, rules_json, created_at)
       VALUES (@id, @version, @contentHash, @status, @rulesJson, @createdAt)`
    );
    const insertRule = db.prepare(
      `INSERT INTO policy_rules (bundle_id, rule_type, rule_id, rule_json)
       VALUES (?, ?, ?, ?)`
    );

    for (const bundle of POLICY_BUNDLES) {
      const existing = db.prepare("SELECT id FROM policy_bundles WHERE id = ?").get(bundle.id);
      if (existing) continue;

      assertValidPolicy(bundle);

      insertPolicy.run({
        id: bundle.id,
        version: bundle.version,
        contentHash: bundle.contentHash,
        status: bundle.status,
        rulesJson: JSON.stringify(bundle),
        createdAt: bundle.createdAt,
      });
      for (const rule of bundle.riskRules) {
        insertRule.run(bundle.id, "RISK", rule.id, JSON.stringify(rule));
      }
      for (const rule of bundle.threatRules) {
        insertRule.run(bundle.id, "THREAT", rule.id, JSON.stringify(rule));
      }
      for (const rule of bundle.trustImpactRules) {
        insertRule.run(bundle.id, "TRUST_IMPACT", rule.id, JSON.stringify(rule));
      }
    }
  });

  insertBundle();
}
