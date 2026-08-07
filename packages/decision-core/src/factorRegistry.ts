/**
 * Authentication factor registry (docs/EXECUTION.md Phase 2).
 *
 * SMS OTP and passkey properties: assurance, phishing-resistance,
 * enrollment requirement, and fixed preference order for selection.
 */
import type { FactorId } from "@mfa/contracts";

export interface FactorDefinition {
  id: FactorId;
  /** Assurance this factor provides: 0 = none, 1 = single factor, 2 = phishing-resistant. */
  assurance: number;
  phishingResistant: boolean;
  /** Whether the factor needs a user capability that can be absent (enrollment). */
  requiresEnrollment: boolean;
}

export const FACTOR_REGISTRY: Record<FactorId, FactorDefinition> = {
  PASSKEY: {
    id: "PASSKEY",
    assurance: 2,
    phishingResistant: true,
    requiresEnrollment: true,
  },
  SMS_OTP: {
    id: "SMS_OTP",
    assurance: 1,
    phishingResistant: false,
    requiresEnrollment: false,
  },
};

/** Fixed preference order used for selection among allowed factors. */
export const FACTOR_PREFERENCE_ORDER: FactorId[] = ["PASSKEY", "SMS_OTP"];

/** Required assurance by risk level (transaction policy step 2). */
export function requiredAssuranceForRisk(riskLevel: "LOW" | "MEDIUM" | "HIGH"): number {
  switch (riskLevel) {
    case "HIGH":
      return 2;
    case "MEDIUM":
      return 1;
    case "LOW":
      return 0;
  }
}
