/**
 * Fair scalar baseline (docs/EXECUTION.md Phase 2).
 *
 * A severity-only policy: it receives ONLY the risk level (and, implicitly,
 * the required assurance derived from it). It never sees threat indicators,
 * so it cannot express channel-specific distrust. The UI uses this only to
 * show information loss, not to claim existing systems are naive.
 */
import type { RiskLevel } from "@mfa/contracts";

export interface BaselineResult {
  requiredAssurance: number;
  requirement: string;
}

export function scalarBaseline(riskLevel: RiskLevel): BaselineResult {
  switch (riskLevel) {
    case "HIGH":
      return {
        requiredAssurance: 2,
        requirement: "Phishing-resistant factor required",
      };
    case "MEDIUM":
      return {
        requiredAssurance: 1,
        requirement: "Any second factor required",
      };
    case "LOW":
      return {
        requiredAssurance: 0,
        requirement: "No additional factor required",
      };
  }
}
