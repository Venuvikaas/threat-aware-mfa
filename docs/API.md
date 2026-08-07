# API Reference — Threat-Aware MFA Decision Service

Base URL (dev): `http://localhost:4000` — the Vite dev server proxies `/api`
and `/health` to the API on port `4000`.

All request and response bodies are JSON. Input and output are runtime-validated
against the frozen Zod schemas in `packages/contracts/src/index.ts`
(docs/EXECUTION.md PART 3). Money is integer minor units (paise for INR).

Hardening (docs/EXECUTION.md Phase 8): request bodies are limited to 32 KB,
`POST /api/v1/decisions` and `POST /api/v1/challenges` are rate-limited
(60/minute by default), and CORS is restricted to the configured frontend
origin (`CORS_ORIGIN`, default `http://localhost:5173`).

---

## Error shape

Every non-2xx response uses the same shape:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable summary",
    "details": { "field": "problem description" },
    "correlationId": "x-correlation-id or generated"
  }
}
```

The `correlationId` is echoed from the `x-correlation-id` request header when
present, otherwise generated per request.

| code | status | meaning |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Request body failed the frozen contract, or JSON was malformed |
| `NOT_FOUND` | 404 | Decision, challenge, user, or route does not exist |
| `CONFLICT` | 409 | Duplicate client transaction ID rejected |
| `POLICY_REJECTION` | 409 | Requested factor is blocked or unavailable for the decision |
| `CHALLENGE_ERROR` | 409 | Challenge missing, expired, consumed, or replay attempted |
| `PAYLOAD_TOO_LARGE` | 413 | Body exceeded the 32 KB limit |
| `RATE_LIMITED` | 429 | Too many requests to a limited endpoint |
| `INTERNAL_ERROR` | 500 | Unhandled server failure |

---

## Endpoints

### `GET /health`

Process and database health. No external checks (there are no external
providers).

```json
{ "status": "ok", "service": "threat-aware-mfa-api", "database": "ok", "time": "2026-08-07T12:00:00.000Z" }
```

`503` with `database: "error"` when the database is unreachable.

### `POST /api/v1/decisions`

Create a decision for a transaction. Validates the request, loads or creates
synthetic demo entities, normalizes and persists signals, evaluates risk,
threat, and factors, and persists the transaction, decision, factor
evaluations, and audit events atomically.

```json
{
  "userId": "user_demo_01",
  "transaction": { "clientTransactionId": "txn_client_001", "amountMinor": 5000000, "currency": "INR", "payeeId": "payee_new_77", "payeeIsKnown": false },
  "session": { "sessionId": "sess_9f3a", "ageSeconds": 120, "failedLoginCount": 0, "ipAddress": "203.0.113.7", "asn": "AS14061", "country": "IN" },
  "device": { "deviceId": "dev_new_42", "trusted": false, "firstSeen": true, "browserFingerprint": "fp-a1b2c3" },
  "signals": { "recentSimChange": true, "geoDistanceFromLastLoginKm": 420.5, "phishingRelayIndicator": false }
}
```

`signals.recentSimChange` and `signals.geoDistanceFromLastLoginKm` accept
`null` for an unknown signal. In demo mode, explicit request signals override
the mock provider values (persisted as source `demo_override`); outside demo
mode overrides are ignored. Repeating a `clientTransactionId` returns
`409 CONFLICT` — it never silently creates a conflicting decision.

Response `201`:

```json
{
  "decisionId": "dec_0001",
  "transactionId": "txn_0001",
  "policyVersion": "2026.08.0",
  "risk": { "level": "HIGH", "reasons": ["high_value_amount", "recent_sim_change", "first_seen_device"] },
  "threat": { "type": "SIM_CHANNEL_COMPROMISE", "support": "HIGH", "evidence": ["recent_sim_change", "first_seen_device", "new_payee"] },
  "factors": [
    { "factor": "PASSKEY", "status": "ALLOWED", "reasonCode": "factor_eligible", "reason": "Enrolled and above required assurance." },
    { "factor": "SMS_OTP", "status": "BLOCKED", "reasonCode": "sim_channel_compromise", "reason": "SMS channel is not trusted under the SIM-channel-compromise hypothesis." }
  ],
  "allowedFactors": ["PASSKEY"],
  "blockedFactors": ["SMS_OTP"],
  "selectedFactor": "PASSKEY",
  "action": "ALLOW_WITH_FACTOR",
  "createdAt": "2026-08-07T12:00:00.000Z"
}
```

Errors: `400 VALIDATION_ERROR`, `404 NOT_FOUND` (unknown user),
`409 CONFLICT` (duplicate client transaction ID), `429 RATE_LIMITED`.

### `GET /api/v1/decisions/:decisionId`

Retrieve a persisted decision and its factor evaluations. Response `200` has
the same shape as the create response. Errors: `404 NOT_FOUND`.

### `GET /api/v1/decisions/:decisionId/audit`

Ordered audit events for a decision (append-only, insertion order).

```json
[
  { "id": "aud_0001", "decisionId": "dec_0001", "eventType": "DECISION_CREATED", "reasonCode": "decision_recorded", "details": { "riskLevel": "HIGH", "threatType": "SIM_CHANNEL_COMPROMISE" }, "createdAt": "2026-08-07T12:00:00.100Z" },
  { "id": "aud_0002", "decisionId": "dec_0001", "eventType": "FACTOR_BLOCKED", "reasonCode": "sim_channel_compromise", "details": { "factor": "SMS_OTP" }, "createdAt": "2026-08-07T12:00:00.110Z" }
]
```

Errors: `404 NOT_FOUND`.

### `GET /api/v1/decisions/:decisionId/signals`

Persisted signal provenance for a decision — every signal with its value,
source adapter, `synthetic` flag, and observed time. The UI renders this to
disclose that all indicators are synthetic demo data.

Errors: `404 NOT_FOUND`.

### `POST /api/v1/challenges`

Create an expiring one-time challenge for a selected or allowed factor. Blocked
and unavailable factors are rejected — this is the policy-enforcement proof
point.

```json
{ "decisionId": "dec_0001", "factor": "PASSKEY" }
```

Response `201`:

```json
{ "challengeId": "ch_0001", "factor": "PASSKEY", "mode": "SIMULATED", "expiresAt": "2026-08-07T12:05:00.000Z" }
```

Errors: `400 VALIDATION_ERROR`, `404 NOT_FOUND` (decision),
`409 POLICY_REJECTION` (blocked or unavailable factor), `429 RATE_LIMITED`.

### `POST /api/v1/challenges/:challengeId/verify`

Verify a challenge. Rejects missing, expired, consumed, and
decision-mismatched challenges; marks the challenge consumed and updates the
transaction state in the same database transaction.

```json
{ "challengeId": "ch_0001", "response": { "simulatedOk": true } }
```

Response `200`:

```json
{ "challengeId": "ch_0001", "verified": true, "transactionStatus": "AUTHORIZED" }
```

A `simulatedOk: false` response verifies to `verified: false` /
`transactionStatus: "DENIED"`. Errors: `400 VALIDATION_ERROR`,
`409 CHALLENGE_ERROR` (missing, expired, consumed, or replay).

### Demo endpoints (disabled outside demo mode)

| endpoint | purpose |
|---|---|
| `GET /api/v1/demo/users` | synthetic identity presets (users, devices, passkey enrollment) |
| `GET /api/v1/demo/baseline?riskLevel=LOW\|MEDIUM\|HIGH` | fair scalar baseline — a function of risk level only |
| `POST /api/v1/demo/users/:userId/passkey-enrollment` `{ "enrolled": false }` | toggle passkey enrollment (demo recovery flow) |
| `POST /api/v1/demo/reset` | reset only synthetic demo transactions/decisions; `403` outside demo mode |

---

## Contract rules (docs/EXECUTION.md PART 3)

- API input and output are runtime-validated.
- Money is integer minor units.
- IDs are server-generated except client transaction ID, session ID, and device ID.
- Server time owns `createdAt`, expiry, and audit timestamps.
- The frontend never calculates risk, threat, or factor eligibility.
- An unavailable or blocked factor cannot create a challenge.
- Repeated use of the same client transaction ID must not create conflicting decisions.
- Every decision stores policy version and normalized evidence.
- Synthetic provider data is tagged as synthetic in storage and in the UI.
