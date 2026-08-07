/**
 * Server-generated identifiers (docs/EXECUTION.md PART 3: "IDs are
 * server-generated except client transaction ID, session ID, and device ID").
 */
import { randomUUID } from "node:crypto";

export function newId(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

/** Parse a JSON column; returns `null` when the stored value is empty. */
export function parseJson<T>(value: string | null | undefined): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}
