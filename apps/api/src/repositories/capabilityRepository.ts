/**
 * User capability persistence (EXECUTION_new2.md §4.4).
 *
 * Capabilities are seeded from demo-data profiles and flipped by demo
 * affordances (passkey enrollment, replay capability forks). A missing row
 * reads as unavailable.
 */
import type { CapabilityId, CapabilityState } from "@mfa/contracts";
import type { Db } from "../db/connection.js";

export class CapabilityRepository {
  constructor(private readonly db: Db) {}

  findByUserId(userId: string): CapabilityState[] {
    const rows = this.db
      .prepare(
        "SELECT capability_id, available FROM user_capabilities WHERE user_id = ? ORDER BY capability_id"
      )
      .all(userId) as { capability_id: string; available: number }[];
    return rows.map((r) => ({
      capabilityId: r.capability_id as CapabilityId,
      available: r.available === 1,
    }));
  }

  /** Demo-only toggle for a single capability (idempotent upsert). */
  setAvailable(userId: string, capabilityId: CapabilityId, available: boolean): void {
    this.db
      .prepare(
        `INSERT INTO user_capabilities (user_id, capability_id, available)
         VALUES (?, ?, ?)
         ON CONFLICT (user_id, capability_id) DO UPDATE SET available = excluded.available`
      )
      .run(userId, capabilityId, available ? 1 : 0);
  }

  /** Capability states after applying replay capability changes. */
  applyChanges(
    base: CapabilityState[],
    changes: { capabilityId: CapabilityId; available: boolean }[]
  ): CapabilityState[] {
    const map = new Map(base.map((c) => [c.capabilityId, c.available]));
    for (const change of changes) {
      map.set(change.capabilityId, change.available);
    }
    return [...map.entries()].map(([capabilityId, available]) => ({ capabilityId, available }));
  }
}
