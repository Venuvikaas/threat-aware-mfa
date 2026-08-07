/**
 * Risk assessment (EXECUTION_new2.md §4.1/5.1, Phase 1).
 *
 * Risk is categorical (LOW | MEDIUM | HIGH) and derived from declarative
 * risk rules — predicates over evidence. A HIGH-severity rule match yields
 * HIGH; otherwise any MEDIUM match yields MEDIUM; otherwise LOW. No
 * probability is ever computed.
 */
import type { EvidenceItem, PolicyBundle, RiskResult } from "@mfa/contracts";
import { evaluatePredicate } from "./predicates.js";

export function assessRisk(
  evidence: EvidenceItem[],
  policy: PolicyBundle
): RiskResult {
  const high: string[] = [];
  const medium: string[] = [];

  for (const rule of policy.riskRules) {
    if (evaluatePredicate(rule.predicate, evidence)) {
      (rule.severity === "HIGH" ? high : medium).push(rule.reasonCode);
    }
  }

  const level = high.length > 0 ? "HIGH" : medium.length > 0 ? "MEDIUM" : "LOW";
  return { level, reasonCodes: [...high, ...medium] };
}
