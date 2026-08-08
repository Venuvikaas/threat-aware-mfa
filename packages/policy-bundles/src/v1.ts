/**
 * Active demo policy data (EXECUTION_new2.md §4.7, Phase 1 [POLICY] boxes).
 *
 * Everything here is declarative data — versioned risk/threat/trust-impact
 * rules plus the factor catalog and selection policy. The engine never
 * contains a rule like "if threat is SIM swap, block SMS"; these rules model
 * *evidence*, *threats*, *trust impacts*, and *factor dependencies*, and the
 * generic evaluator derives SMS ineligibility from SIM_OWNERSHIP becoming
 * DISTRUSTED while SMS OTP requires SIM_OWNERSHIP >= TRUSTED.
 *
 * The content hash is computed by hashPolicy.ts (Phase 2) — this module
 * exports the immutable data without it.
 */
import type {
  FactorDefinition,
  PolicyBundle,
  RiskRule,
  ThreatRule,
  TrustImpactRule,
} from "@mfa/contracts";

export const DEMO_BUNDLE_ID = "bundle_demo";
export const DEMO_POLICY_VERSION = "1.0.0";

/* Risk rules (categorical, predicate over evidence) ---------------------- */

export const RISK_RULES: RiskRule[] = [
  { id: "risk_sim_change", predicate: { evidenceType: "RECENT_SIM_CHANGE", op: "EQ", value: true }, severity: "HIGH", reasonCode: "sim_change" },
  { id: "risk_phishing", predicate: { evidenceType: "PHISHING_RELAY_INDICATOR", op: "EQ", value: true }, severity: "HIGH", reasonCode: "phishing_relay" },
  { id: "risk_high_value", predicate: { evidenceType: "HIGH_VALUE_TRANSACTION", op: "EQ", value: true }, severity: "HIGH", reasonCode: "high_value" },
  { id: "risk_first_seen", predicate: { evidenceType: "FIRST_SEEN_DEVICE", op: "EQ", value: true }, severity: "MEDIUM", reasonCode: "first_seen_device" },
  { id: "risk_failed_logins", predicate: { evidenceType: "FAILED_LOGIN_BURST", op: "EQ", value: true }, severity: "MEDIUM", reasonCode: "failed_login_burst" },
  { id: "risk_new_payee", predicate: { evidenceType: "NEW_PAYEE", op: "EQ", value: true }, severity: "MEDIUM", reasonCode: "new_payee" },
  { id: "risk_geo", predicate: { evidenceType: "GEO_DISTANCE_ANOMALY", op: "EQ", value: true }, severity: "MEDIUM", reasonCode: "geo_anomaly" },
];

/* Threat rules (independent hypotheses, primary/supporting/conflicting) -- */

export const THREAT_RULES: ThreatRule[] = [
  // SIM_CHANNEL_COMPROMISE
  { id: "threat_sim_primary", threatId: "SIM_CHANNEL_COMPROMISE", kind: "PRIMARY", predicate: { evidenceType: "RECENT_SIM_CHANGE", op: "EQ", value: true } },
  { id: "threat_sim_support_first_seen", threatId: "SIM_CHANNEL_COMPROMISE", kind: "SUPPORTING", predicate: { evidenceType: "FIRST_SEEN_DEVICE", op: "EQ", value: true } },
  { id: "threat_sim_support_failed", threatId: "SIM_CHANNEL_COMPROMISE", kind: "SUPPORTING", predicate: { evidenceType: "FAILED_LOGIN_BURST", op: "EQ", value: true } },
  { id: "threat_sim_support_high_value", threatId: "SIM_CHANNEL_COMPROMISE", kind: "SUPPORTING", predicate: { evidenceType: "HIGH_VALUE_TRANSACTION", op: "EQ", value: true } },
  { id: "threat_sim_support_new_payee", threatId: "SIM_CHANNEL_COMPROMISE", kind: "SUPPORTING", predicate: { evidenceType: "NEW_PAYEE", op: "EQ", value: true } },
  { id: "threat_sim_conflict_phishing", threatId: "SIM_CHANNEL_COMPROMISE", kind: "CONFLICTING", predicate: { evidenceType: "PHISHING_RELAY_INDICATOR", op: "EQ", value: true } },
  // PHISHING_RELAY
  { id: "threat_phish_primary", threatId: "PHISHING_RELAY", kind: "PRIMARY", predicate: { evidenceType: "PHISHING_RELAY_INDICATOR", op: "EQ", value: true } },
  { id: "threat_phish_support_failed", threatId: "PHISHING_RELAY", kind: "SUPPORTING", predicate: { evidenceType: "FAILED_LOGIN_BURST", op: "EQ", value: true } },
  { id: "threat_phish_support_new_payee", threatId: "PHISHING_RELAY", kind: "SUPPORTING", predicate: { evidenceType: "NEW_PAYEE", op: "EQ", value: true } },
  { id: "threat_phish_support_first_seen", threatId: "PHISHING_RELAY", kind: "SUPPORTING", predicate: { evidenceType: "FIRST_SEEN_DEVICE", op: "EQ", value: true } },
  { id: "threat_phish_conflict_sim", threatId: "PHISHING_RELAY", kind: "CONFLICTING", predicate: { evidenceType: "RECENT_SIM_CHANGE", op: "EQ", value: true } },
  // DEVICE_INTEGRITY_CONCERN (narrow: fires on a first-seen device)
  { id: "threat_dev_primary", threatId: "DEVICE_INTEGRITY_CONCERN", kind: "PRIMARY", predicate: { evidenceType: "FIRST_SEEN_DEVICE", op: "EQ", value: true } },
  { id: "threat_dev_support_failed", threatId: "DEVICE_INTEGRITY_CONCERN", kind: "SUPPORTING", predicate: { evidenceType: "FAILED_LOGIN_BURST", op: "EQ", value: true } },
  { id: "threat_dev_support_geo", threatId: "DEVICE_INTEGRITY_CONCERN", kind: "SUPPORTING", predicate: { evidenceType: "GEO_DISTANCE_ANOMALY", op: "EQ", value: true } },
];

/* Trust impact rules (assessed threats change ordinal trust state) ------- */

export const TRUST_IMPACT_RULES: TrustImpactRule[] = [
  { id: "trust_sim_ownership", threatId: "SIM_CHANNEL_COMPROMISE", domainId: "SIM_OWNERSHIP", impact: "DISTRUST" },
  { id: "trust_sim_delivery", threatId: "SIM_CHANNEL_COMPROMISE", domainId: "TELECOM_DELIVERY", impact: "DISTRUST" },
  { id: "trust_phish_delivery", threatId: "PHISHING_RELAY", domainId: "TELECOM_DELIVERY", impact: "DISTRUST" },
  { id: "trust_phish_verification", threatId: "PHISHING_RELAY", domainId: "USER_VERIFICATION", impact: "DEGRADE" },
  { id: "trust_dev_integrity", threatId: "DEVICE_INTEGRITY_CONCERN", domainId: "DEVICE_INTEGRITY", impact: "DEGRADE" },
  { id: "trust_dev_session", threatId: "DEVICE_INTEGRITY_CONCERN", domainId: "SESSION_INTEGRITY", impact: "DISTRUST" },
];

/* Factor catalog (declarative dependencies — no factor-specific code) ---- */

export const FACTOR_DEFINITIONS: FactorDefinition[] = [
  {
    id: "SMS_OTP",
    displayName: "SMS One-Time Password",
    assurance: "AAL1",
    trustRequirements: [
      { domainId: "SIM_OWNERSHIP", minimumState: "TRUSTED", rationaleCode: "sms_requires_sim_ownership" },
      { domainId: "TELECOM_DELIVERY", minimumState: "TRUSTED", rationaleCode: "sms_requires_telecom_delivery" },
    ],
    capabilityRequirements: ["NETWORK_AVAILABLE"],
    frictionTier: "LOW",
    adapterId: "simulated_sms_otp",
    enabled: true,
  },
  {
    id: "PASSKEY",
    displayName: "Passkey",
    assurance: "AAL2",
    trustRequirements: [
      { domainId: "DEVICE_INTEGRITY", minimumState: "DEGRADED", rationaleCode: "passkey_requires_device_integrity" },
      { domainId: "ORIGIN_BINDING", minimumState: "TRUSTED", rationaleCode: "passkey_requires_origin_binding" },
      { domainId: "CREDENTIAL_INTEGRITY", minimumState: "TRUSTED", rationaleCode: "passkey_requires_credential_integrity" },
    ],
    capabilityRequirements: ["PASSKEY_ENROLLED", "WEBAUTHN_SUPPORTED"],
    frictionTier: "LOW",
    adapterId: "simulated_passkey",
    enabled: true,
  },
  {
    id: "TOTP",
    displayName: "Time-based One-Time Password",
    assurance: "AAL2",
    trustRequirements: [
      { domainId: "CREDENTIAL_INTEGRITY", minimumState: "TRUSTED", rationaleCode: "totp_requires_credential_integrity" },
      { domainId: "KNOWLEDGE_SECRECY", minimumState: "TRUSTED", rationaleCode: "totp_requires_knowledge_secrecy" },
    ],
    capabilityRequirements: ["TOTP_SEED"],
    frictionTier: "MEDIUM",
    adapterId: "totp",
    enabled: true,
  },
  {
    id: "PIN",
    displayName: "Personal Identification Number",
    assurance: "AAL1",
    trustRequirements: [
      { domainId: "SESSION_INTEGRITY", minimumState: "TRUSTED", rationaleCode: "pin_requires_session_integrity" },
      { domainId: "KNOWLEDGE_SECRECY", minimumState: "TRUSTED", rationaleCode: "pin_requires_knowledge_secrecy" },
    ],
    capabilityRequirements: [],
    frictionTier: "HIGH",
    adapterId: "pin",
    enabled: true,
  },
];

export const SELECTION_POLICY = {
  requiredAssuranceByRisk: { LOW: "AAL1", MEDIUM: "AAL1", HIGH: "AAL2" },
  tieBreaker: ["PASSKEY", "TOTP", "SMS_OTP", "PIN"],
} as const;

/** The active demo bundle data (contentHash filled by hashPolicy). */
export const DEMO_POLICY_DATA: Omit<PolicyBundle, "contentHash"> = {
  id: DEMO_BUNDLE_ID,
  version: DEMO_POLICY_VERSION,
  status: "ACTIVE",
  riskRules: RISK_RULES,
  threatRules: THREAT_RULES,
  trustImpactRules: TRUST_IMPACT_RULES,
  factorDefinitions: FACTOR_DEFINITIONS,
  selectionPolicy: {
    requiredAssuranceByRisk: {
      LOW: SELECTION_POLICY.requiredAssuranceByRisk.LOW,
      MEDIUM: SELECTION_POLICY.requiredAssuranceByRisk.MEDIUM,
      HIGH: SELECTION_POLICY.requiredAssuranceByRisk.HIGH,
    },
    tieBreaker: [...SELECTION_POLICY.tieBreaker],
  },
  createdAt: "2026-08-01T00:00:00.000Z",
};

/* Candidate policy v1.1.0 (Stretch B) -------------------------------------- */
/**
 * DRAFT candidate bundle with exactly one deliberate rule change vs v1.0.0:
 * SIM_CHANNEL_COMPROMISE now also DEGRADEs CREDENTIAL_INTEGRITY. Under the
 * generic evaluator this makes PASSKEY and TOTP ineligible in the SIM-swap
 * scenario (both require CREDENTIAL_INTEGRITY >= TRUSTED), so replaying that
 * decision under v1.1.0 flips selection from PASSKEY to assisted recovery —
 * a pure policy counterfactual with no input change.
 */
export const CANDIDATE_BUNDLE_ID = "bundle_demo_1_1_0";
export const CANDIDATE_POLICY_VERSION = "1.1.0";

export const CANDIDATE_TRUST_IMPACT_RULES: TrustImpactRule[] = [
  ...TRUST_IMPACT_RULES,
  { id: "trust_sim_credentials", threatId: "SIM_CHANNEL_COMPROMISE", domainId: "CREDENTIAL_INTEGRITY", impact: "DEGRADE" },
];

/** The candidate bundle data (contentHash filled by hashPolicy). */
export const CANDIDATE_POLICY_DATA: Omit<PolicyBundle, "contentHash"> = {
  id: CANDIDATE_BUNDLE_ID,
  version: CANDIDATE_POLICY_VERSION,
  status: "DRAFT",
  riskRules: RISK_RULES,
  threatRules: THREAT_RULES,
  trustImpactRules: CANDIDATE_TRUST_IMPACT_RULES,
  factorDefinitions: FACTOR_DEFINITIONS,
  selectionPolicy: {
    requiredAssuranceByRisk: {
      LOW: SELECTION_POLICY.requiredAssuranceByRisk.LOW,
      MEDIUM: SELECTION_POLICY.requiredAssuranceByRisk.MEDIUM,
      HIGH: SELECTION_POLICY.requiredAssuranceByRisk.HIGH,
    },
    tieBreaker: [...SELECTION_POLICY.tieBreaker],
  },
  createdAt: "2026-08-02T00:00:00.000Z",
};
