# Supported Threat Model

Narrow, defensible attacker capabilities only. Every supported threat states
exactly what the attacker controls and — just as important — what it does
**not** imply. Nothing here claims real fraud detection, calibrated
probabilities, or production readiness.

## Method

Threats are assessed **independently** from evidence. Each assessment cites
supporting and conflicting evidence and the rules that activated. Trust
domains then change based on **assessed** threats (STRONG applies the declared
impact, MODERATE degrades, WEAK/UNSUPPORTED has no impact). Factor eligibility
is derived from declarative dependencies on those trust domains — the engine
contains no `if threat is X, block factor Y` branch.

Support bands:

| support | meaning |
|---|---|
| `STRONG` | ≥1 fresh primary evidence **and** ≥1 supporting evidence |
| `MODERATE` | ≥1 fresh primary evidence (no supporting), or ≥2 supporting evidences |
| `WEAK` | only stale primary, or a single supporting evidence |
| `UNSUPPORTED` | no primary/supporting, or conflicting evidence outweighs |

A **stale** primary evidence can never produce STRONG or MODERATE support —
stale primary alone yields at most WEAK. A conflicting fresh evidence
suppresses the hypothesis to UNSUPPORTED unless a fresh primary also exists.

## SIM_CHANNEL_COMPROMISE

**Attacker capability:** control of the subscriber identity (SIM swap /
port-out). The attacker can receive the victim's SMS.

**Evidence:** primary `RECENT_SIM_CHANGE = true` (fresh); supporting
`FIRST_SEEN_DEVICE`, `NEW_PAYEE`, `HIGH_VALUE_TRANSACTION`,
`FAILED_LOGIN_BURST`.

**Trust impacts:** `SIM_OWNERSHIP` → DISTRUSTED, `TELECOM_DELIVERY` →
DISTRUSTED.

**Factor implications:** SMS OTP requires `SIM_OWNERSHIP` TRUSTED and
`TELECOM_DELIVERY` TRUSTED → SMS OTP becomes INELIGIBLE. Passkey, TOTP, and
PIN do not depend on SIM ownership → unaffected by this hypothesis alone.

**Does not imply:** device compromise, harvested credentials, or any
weakness of origin-bound (passkey) authentication.

## PHISHING_RELAY

**Attacker capability:** relays the user's interaction to a lookalike origin
and can harvest what the user types — knowledge secrets such as PINs and
one-time codes.

**Evidence:** primary `PHISHING_RELAY_INDICATOR = true` (fresh); supporting
`GEO_DISTANCE_ANOMALY`, `NEW_PAYEE`, `FAILED_LOGIN_BURST`,
`FIRST_SEEN_DEVICE`.

**Trust impacts:** `KNOWLEDGE_SECRECY` → DISTRUSTED, `CREDENTIAL_INTEGRITY` →
DEGRADED, `ORIGIN_BINDING` → DEGRADED.

**Factor implications:** SMS OTP and TOTP require `KNOWLEDGE_SECRECY` ≥
DEGRADED and PIN requires `KNOWLEDGE_SECRECY` TRUSTED → all knowledge-based
factors become INELIGIBLE. Passkey's requirements tolerate DEGRADED
`CREDENTIAL_INTEGRITY` / `ORIGIN_BINDING` (passkeys are origin-bound and
resist relay), so passkey may remain eligible.

**Does not imply:** SIM control, device compromise, or that every relay
attempt succeeds. The relay hypothesis degrades credential integrity only —
it does not assert credentials were captured.

## DEVICE_INTEGRITY_CONCERN

**Attacker capability:** the transaction originates from a first-seen or
unregistered device with additional risk signals, so the device's integrity
cannot be relied on.

**Evidence:** primary `FIRST_SEEN_DEVICE = true` (fresh); supporting
`GEO_DISTANCE_ANOMALY`, `FAILED_LOGIN_BURST`.

**Trust impacts:** `DEVICE_INTEGRITY` → DEGRADED.

**Factor implications:** Passkey requires `DEVICE_INTEGRITY` ≥ DEGRADED, so
passkey **remains eligible** under this hypothesis. This hypothesis is
narrowly scoped: it does not claim that all passkeys fail under all
device-compromise conditions, nor that any passkey survives any of them.

**Does not imply:** confirmed device takeover, keylogging, or malware on the
device.

## Evidence predicates and rule wiring

Risk rules (deterministic, versioned in the policy bundle):

| evidence | severity | reason code |
|---|---|---|
| `HIGH_VALUE_TRANSACTION = true` | HIGH | `high_value_transaction` |
| `RECENT_SIM_CHANGE = true` | HIGH | `recent_sim_change` |
| `PHISHING_RELAY_INDICATOR = true` | HIGH | `phishing_relay_indicator` |
| `FIRST_SEEN_DEVICE = true` | MEDIUM | `first_seen_device` |
| `FAILED_LOGIN_BURST = true` | MEDIUM | `failed_login_burst` |
| `GEO_DISTANCE_ANOMALY = true` | MEDIUM | `geo_distance_anomaly` |
| `NEW_PAYEE = true` | MEDIUM | `new_payee` |

Risk level: HIGH if any HIGH rule fires, else MEDIUM if any MEDIUM rule
fires, else LOW. The two hero scenarios both fire
`HIGH_VALUE_TRANSACTION` (and more), so they are equal-risk by construction.

## Unsupported threats

Not modeled (documented, not silent): credential-stuffing account takeover
from an identity-provider breach, insider fraud, malware keylogging,
real-time fraud rings, and any threat requiring calibrated likelihoods. When
evidence is unavailable or contradictory, the engine is conservative: no
threat gets STRONG support, and trust defaults stay TRUSTED only where no
impact applies.
