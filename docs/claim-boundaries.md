# Security Claim Boundaries

Record of what this product explicitly does **not** claim (EXECUTION_new2.md
Phase 0: *Record excluded claims and unsupported threats*).

## Never claimed

- **No fraud detection.** Evidence is synthetic demo data from mock providers;
  the service never claims to detect real fraud, and it cannot generalize
  beyond the versioned rules.
- **No calibrated probabilities.** Threat support is ordinal
  (STRONG/MODERATE/WEAK/UNSUPPORTED) and trust is ordinal state — there are
  no percentages, scores, or calibrated likelihoods anywhere.
- **No live integrations.** Mock telecom, device, session, and capability
  providers implement a real contract but are visibly synthetic. There is no
  live carrier, bank, UPI, Account Aggregator, or device-intelligence API.
- **No real SMS delivery** and no claim that OTP delivery is secure.
- **No device-compromise certainty.** DEVICE_INTEGRITY_CONCERN is a narrow
  hypothesis; the service never claims that passkeys fail (or survive) all
  device-compromise conditions.
- **No production readiness or compliance.** Nothing here is a bank core,
  identity provider, fraud model, or compliance platform.

## Unsupported threats (documented, not silent)

Credential-stuffing takeover via identity-provider breach, insider fraud,
malware keylogging, real-time fraud rings, and any hypothesis that would
require calibrated likelihoods are outside the supported model — see
`docs/THREAT_MODEL.md`.

## Integrity rules enforced in code

- No numeric trust percentages exist in contracts, policy, or UI.
- Every provider result carries provider id, provider type, observation
  time, `synthetic`, quality, and status.
- Policy bundles are immutable and content-hashed; a corrupt hash is rejected.
- No OTP values, passkey private keys, biometric data, or real customer data
  are ever stored.
- Replays never mutate original decisions; remediation is never emitted
  without replay verification.
