/**
 * Policy-bundle persistence (EXECUTION_new2.md Phase 2).
 *
 * Active bundles are immutable. Every load verifies the stored content hash
 * against the canonical hash of the stored rules JSON — a corrupt row fails
 * loudly instead of reaching the engine.
 */
import type { PolicyBundle } from "@mfa/contracts";
import { verifyPolicyHash } from "@mfa/policy-bundles";
import type { Db } from "../db/connection.js";

interface PolicyRecord {
  id: string;
  version: string;
  content_hash: string;
  status: string;
  rules_json: string;
  created_at: string;
}

function toBundle(row: PolicyRecord): PolicyBundle {
  const bundle = JSON.parse(row.rules_json) as PolicyBundle;
  if (!verifyPolicyHash(bundle)) {
    throw new Error(
      `Policy bundle ${bundle.id} (${bundle.version}) failed content-hash verification`
    );
  }
  return bundle;
}

export class PolicyRepository {
  constructor(private readonly db: Db) {}

  findActive(): PolicyBundle | undefined {
    const row = this.db
      .prepare("SELECT * FROM policy_bundles WHERE status = 'ACTIVE' ORDER BY created_at DESC LIMIT 1")
      .get() as PolicyRecord | undefined;
    return row ? toBundle(row) : undefined;
  }

  findByVersion(version: string): PolicyBundle | undefined {
    const row = this.db
      .prepare("SELECT * FROM policy_bundles WHERE version = ?")
      .get(version) as PolicyRecord | undefined;
    return row ? toBundle(row) : undefined;
  }

  findById(id: string): PolicyBundle | undefined {
    const row = this.db
      .prepare("SELECT * FROM policy_bundles WHERE id = ?")
      .get(id) as PolicyRecord | undefined;
    return row ? toBundle(row) : undefined;
  }
}
