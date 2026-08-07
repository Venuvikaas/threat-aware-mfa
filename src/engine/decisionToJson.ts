import type { Decision } from "./types";

/**
 * Serialize a decision to formatted JSON for the export action.
 *
 * Pure and deterministic: the output is exactly the engine's `Decision`
 * object with no UI-only fields added. The UI copies this string to the
 * clipboard; nothing else is invented at export time.
 */
export function decisionToJson(decision: Decision): string {
  return JSON.stringify(decision, null, 2);
}
