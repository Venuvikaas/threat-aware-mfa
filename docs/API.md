# API Reference

Base path: `/api/v1` unless noted. All request/response bodies are JSON.
Errors use one frozen shape (see [Errors](#errors)).

- [Health and demo](#health-and-demo)
- [Decisions](#decisions)
- [Challenges](#challenges)
- [Replay and diff](#replay-and-diff)
- [Verified remediation](#verified-remediation)
- [Passkey enrollment (stretch)](#passkey-enrollment-stretch)
- [Errors](#errors)
- [Common types](#common-types)

## Health and demo

### `GET /health`

```json
{ "status": "ok", "service": "threat-aware-mfa-api", "database": "ok", "time": "2026-08-07T08:00:00.000Z" }
```

### `GET /api/v1/demo/scenarios`

Judge presets. Returns the three deterministic demo scenarios with the exact
request shape the API accepts:

```json
{
  "scenarios": [
    { "id": "sim_swap", "label": "₹50,000 SIM-change transfer", "description": "…" },
    { "id": "phishing_relay", "label": "₹50,000 phishing relay", "description": "…" },
    { "id": "constrained_capability", "label": "SIM change without a passkey", "description": "…" }
  ]
}
```

### `POST /api/v1/demo/reset`

Deletes demo decisions, challenges, replays, remediations, and trace state so
the demo restarts deterministically. **Disabled unless `DEMO_MODE=true`** —
returns `403 DEMO_MODE_DISABLED` otherwise.

```json
{ "reset": true, "at": "2026-08-07T08:00:00.000Z" }
```

## Decisions

### `POST /api/v1/decisions`

Create an authentication decision. The response carries the complete reasoning
chain: normalized evidence with provenance, independent threat assessments,
ordinal trust states, generic factor evaluations, the selection, and the full
structured causality trace.

Request:

```json
{
  "userId": "user_demo_01",
  "clientTransactionId": "ct_20260807_001",
  "transaction": {
    "amountMinor": 5000000,
    "currency": "INR",
    "payeeId": "payee_new_77",
    "payeeIsKnown": false
  },
  "session": {
    "sessionId": "sess_unusual_01",
    "deviceId": "dev_new_01",
    "ageSeconds": 120,
    "failedLoginCount": 2,
    "ipAddress": "198.51.100.44",
    "asn": "AS16509",
    "country": "US"
  },
  "evidenceOverrides": [
    { "type": "RECENT_SIM_CHANGE", "value": true },
    { "type": "HIGH_VALUE_TRANSACTION", "value": true }
  ],
  "policyVersion": "1.0.0"
}
```

- `evidenceOverrides` is **demo-only**: outside `DEMO_MODE=true` the API
  returns `403 DEMO_MODE_DISABLED`.
- `policyVersion` is optional; default is the active bundle.
- Repeated `clientTransactionId` returns `409 CONFLICT` (idempotency).

`201 Created` — response:

```json
{
  "decisionId": "dec_ab12cd34ef56",
  "transactionId": "txn_78ab90cd12ef",
  "policy": { "bundleId": "bundle_demo", "version": "1.0.0", "contentHash": "sha256:…" },
  "risk": { "level": "HIGH", "reasonCodes": ["sim_change", "high_value"] },
  "evidence": [
    {
      "id": "ev_1", "type": "RECENT_SIM_CHANGE", "value": true,
      "providerId": "mock_telco", "providerType": "telco",
      "observedAt": "2026-08-07T08:00:00.000Z", "validUntil": null,
      "synthetic": true, "quality": "CONFIRMED", "status": "ACTIVE"
    }
  ],
  "threats": [
    {
      "threatId": "SIM_CHANNEL_COMPROMISE", "support": "STRONG",
      "supportingEvidenceIds": ["ev_1", "ev_2"],
      "conflictingEvidenceIds": [],
      "activatedRuleIds": ["threat_sim_primary", "threat_sim_supporting"]
    }
  ],
  "trust": [
    {
      "domainId": "SIM_OWNERSHIP", "state": "DISTRUSTED",
      "evidenceIds": ["ev_1"], "threatIds": ["SIM_CHANNEL_COMPROMISE"],
      "activatedRuleIds": ["trust_sim_ownership_distrust"]
    }
  ],
  "factors": [
    {
      "factorId": "SMS_OTP", "status": "INELIGIBLE",
      "failedRequirements": [{
        "kind": "TRUST", "requirementId": "sms_requires_sim_ownership",
        "actualState": "DISTRUSTED", "requiredState": "TRUSTED",
        "evidenceIds": ["ev_1"], "ruleIds": ["trust_sim_ownership_distrust"],
        "reasonCode": "trust_requirement_failed"
      }],
      "assuranceSatisfied": true, "frictionTier": "LOW", "traceEventIds": ["tr_4"]
    }
  ],
  "selectedFactorId": "PASSKEY",
  "action": "CHALLENGE",
  "trace": [
    {
      "id": "tr_1", "phase": "EVIDENCE_NORMALIZATION", "ruleId": "ev_norm",
      "ruleVersion": "1.0.0", "inputRefs": [], "outputRefs": ["ev_1"],
      "explanationCode": "evidence_normalized", "sequence": 0
    }
  ],
  "createdAt": "2026-08-07T08:00:00.000Z"
}
```

`action` is `"CHALLENGE"` when a factor was selected, `"ASSISTED_RECOVERY"`
when no factor remains eligible or available.

### `GET /api/v1/decisions/:decisionId`

Returns the persisted decision in the exact response shape above.

### `GET /api/v1/decisions/:decisionId/trace`

Returns only the structured causality trace:

```json
[
  { "id": "tr_1", "phase": "EVIDENCE_NORMALIZATION", "ruleId": "ev_norm", "ruleVersion": "1.0.0", "inputRefs": [], "outputRefs": ["ev_1"], "explanationCode": "evidence_normalized", "sequence": 0 }
]
```

## Challenges

### `POST /api/v1/challenges`

Create a server-enforced challenge for a factor of a persisted decision.

```json
{ "decisionId": "dec_ab12cd34ef56", "factor": "PASSKEY" }
```

- `factor` must be `ELIGIBLE` in the persisted decision — otherwise
  `409 POLICY_REJECTION` with the stored factor state as `details`. Ineligible,
  unavailable, disabled, and non-selected factors can never create challenges
  through the direct API.
- `preferSimulated: true` (demo-only, rejected outside demo mode) forces the
  labeled SIMULATED mode even when a real WebAuthn ceremony would be possible.

`201 Created`:

```json
{ "challengeId": "ch_1234abcd5678", "factor": "PASSKEY", "mode": "SIMULATED", "expiresAt": "2026-08-07T08:05:00.000Z" }
```

`mode` is `"SIMULATED"` (labeled demo execution) or `"WEBAUTHN"` (real
ceremony, `publicOptions` carries the WebAuthn options).

### `POST /api/v1/challenges/:challengeId/verify`

```json
{ "challengeId": "ch_1234abcd5678", "response": { "simulatedOk": true } }
```

The URL segment and body `challengeId` must match. Verification rejects:

- unknown challenges (`404 NOT_FOUND`),
- expired challenges (`409 CHALLENGE_ERROR`),
- already-consumed challenges (`409 CHALLENGE_ERROR`),
- WEBAUTHN challenges verified from a different origin (`409 CHALLENGE_ERROR`).

`200 OK`:

```json
{ "challengeId": "ch_1234abcd5678", "verified": true, "transactionStatus": "AUTHORIZED" }
```

## Replay and diff

### `POST /api/v1/decisions/:decisionId/replays`

Replay a decision without mutating it. `EXACT` replay re-runs the original
normalized evidence under the original policy version (determinism proof);
`FORK` replay applies only the declared evidence/capability changes.

```json
{ "mode": "FORK", "capabilityChanges": [{ "capabilityId": "PASSKEY_ENROLLED", "available": false }] }
```

`201 Created`:

```json
{
  "replayId": "rp_…",
  "sourceDecisionId": "dec_ab12cd34ef56",
  "mode": "FORK",
  "policyVersion": "1.0.0",
  "producedDecisionId": "dec_78cd90ef12ab",
  "createdAt": "2026-08-07T08:01:00.000Z"
}
```

### `GET /api/v1/replays/:replayId`

Returns the replay record plus the produced decision response.

### `GET /api/v1/replays/:replayId/diff`

Structured semantic diff between source and produced decision — separated by
section (`INPUT`, `THREAT`, `TRUST`, `FACTOR`, `RULE`, `SELECTION`), never
comparing generated IDs or timestamps:

```json
{
  "replayId": "rp_…",
  "sourceDecisionId": "dec_ab12cd34ef56",
  "identical": false,
  "sections": [
    {
      "section": "FACTOR",
      "changes": [{ "path": "factors.PASSKEY.status", "before": "ELIGIBLE", "after": "UNAVAILABLE" }]
    },
    {
      "section": "SELECTION",
      "changes": [{ "path": "selectedFactorId", "before": "PASSKEY", "after": null }]
    }
  ]
}
```

## Verified remediation

### `POST /api/v1/decisions/:decisionId/remediations/:factorId/verify`

Derive candidate remediation change sets from the factor's failed requirements,
verify each by replay, and return only replay-verified results:

```json
{ "decisionId": "dec_ab12cd34ef56", "factorId": "PASSKEY", "verified": true, "wouldBecomeEligible": true, "wouldBeSelected": true, "changeSets": [
  { "capabilityChanges": [{ "capabilityId": "PASSKEY_ENROLLED", "available": true }] }
] }
```

Precise claim language: `wouldBecomeEligible` only when replay proves it,
`wouldBeSelected` only when replay proves the factor is selected after the
change, and neither is emitted when the factor remains ineligible.

## Passkey enrollment (stretch)

Real WebAuthn registration is demo-gated (the only users are synthetic).

### `POST /api/v1/passkeys/register/options`

```json
{ "userId": "user_demo_01" }
```

Returns `{ "ceremonyId": "…", "options": { … } }` — the WebAuthn registration
options, bound to the request `Origin` header.

### `POST /api/v1/passkeys/register/verify`

```json
{ "ceremonyId": "…", "response": { … } }
```

Persists public credential data only and flips the user's `PASSKEY_ENROLLED`
capability. The simulated adapter remains the explicitly labeled fallback for
challenges whenever no real ceremony is possible.

## Errors

All errors share one shape:

```json
{ "error": { "code": "POLICY_REJECTION", "message": "…", "details": { … }, "correlationId": "…" } }
```

| Code | HTTP | Meaning |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Malformed body (Zod details in `error.details`) |
| `NOT_FOUND` | 404 | Unknown decision / challenge / replay |
| `CONFLICT` | 409 | Duplicate `clientTransactionId` |
| `POLICY_REJECTION` | 409 | Factor not eligible for a persisted decision |
| `CHALLENGE_ERROR` | 409 | Expired, consumed, or wrong-origin challenge |
| `PAYLOAD_TOO_LARGE` | 413 | Body over the 32kb limit |
| `RATE_LIMITED` | 429 | Too many requests on critical endpoints |
| `DEMO_MODE_DISABLED` | 403 | Demo-only affordance outside demo mode |
| `INTERNAL_ERROR` | 500 | Unhandled failure (never leaks internals) |

## Common types

- `RiskLevel`: `LOW | MEDIUM | HIGH` (categorical — no probabilities).
- `TrustState`: `TRUSTED | DEGRADED | DISTRUSTED | UNKNOWN` (ordinal — no percentages).
- `ThreatSupport`: `STRONG | MODERATE | WEAK | UNSUPPORTED`.
- `FactorStatus`: `ELIGIBLE | INELIGIBLE | UNAVAILABLE`.
- `TracePhase`: `EVIDENCE_NORMALIZATION | THREAT_ASSESSMENT | TRUST_ASSESSMENT | FACTOR_ELIGIBILITY | SELECTION | CHALLENGE | OUTCOME`.

All schemas are frozen in `packages/contracts` and validated at runtime.
