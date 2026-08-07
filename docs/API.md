# API Reference — Threat-Aware MFA Decision Service

Base URL (dev): `http://localhost:4000` — the Vite dev server proxies `/api`
and `/health` to the API on port `4000`.

All request and response bodies are JSON. Input and output are runtime-validated
against the frozen Zod schemas in `packages/contracts/src/index.ts`
(docs/EXECUTION.md PART 3). Money is integer minor units (paise for INR).

---

## Error shape

Every non-2xx response uses the same shape:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable summary",
    "details": { "field": "problem description" }
  }
}
```

| code | meaning |
|---|---|
| `VALIDATION_ERROR` | Request body failed the frozen contract |
| `NOT_FOUND` | Decision, challenge, or route does not exist |
| `CONFLICT` | Duplicate client transaction ID rejected |
| `POLICY_REJECTION` | Requested factor is blocked or unavailable for the decision |
| `CHALLENGE_ERROR` | Challenge missing, expired, consumed, or replay attempted |
| `INTERNAL_ERROR` | Unhandled server failure |

---

## Endpoints

### `GET /health`

Process and database health. No external checks (there are no external
providers).

```text
GET /health
```

```json
{
  "status": "ok",
  "service": "threat-aware-mfa-api",
  "database": "ok",
  "time": "2026-08-07T12:00:00.000Z"
}
```

### `POST /api/v1/decisions`

Create a decision for a transaction. Validates the request, loads or creates
synthetic demo entities, normalizes and persists signals, evaluates risk,
threat, and factors, and persists the transaction, decision, factor
evaluations, and audit events atomically.

```text
POST /api/v1/decisions
Content-Type: application/json
```

```json
{
  "userId": "user_demo_01",
  "transaction": {
    "clientTransactionId": "txn_client_001",
    "amountMinor": 5000000,
    "currency": "INR",
    "payeeId": "payee_new_77",
    "payeeIsKnown": false
  },
  "session": {
    "sessionId": "sess_9f3a",
    "ageSeconds": 120,
    "failedLoginCount": 0,
    "ipAddress": "203.0.113.7",
    "asn": "AS14061",
    "country": "IN"
  },
  "device": {
    "deviceId": "dev_new_42",
    "trusted": false,
    "firstSeen": true,
    "browserFingerprint": "fp-a1b2c3"
  },
  "signals": {
    "recentSimChange": true,
    "geoDistanceFromLastLoginKm": 420.5,
    "phishingRelayIndicator": false
  }
}
```

`signals.recentSimChange` and `signals.geoDistanceFromLastLoginKm` accept
`null` for an unknown signal. Repeating a `clientTransactionId` does not
silently create a conflicting decision (idempotency, Phase 3).

Response `200`:

```json
{
  "decisionId": "dec_0001",
  "transactionId": "txn_0001",
  "policyVersion": "2026.08.0",
  "risk": {
    "level": "HIGH",
    "reasons": ["high_value_amount", "recent_sim_change", "first_seen_device"]
  },
  "threat": {
    "type": "SIM_CHANNEL_COMPROMISE",
    "support": "HIGH",
    "evidence": ["recent_sim_change", "first_seen_device", "new_payee"]
  },
  "factors": [
    {
      "factor": "PASSKEY",
      "status": "ALLOWED",
      "reasonCode": "factor_eligible",
      "reason": "Enrolled and above required assurance."
    },
    {
      "factor": "SMS_OTP",
      "status": "BLOCKED",
      "reasonCode": "sim_channel_compromise",
      "reason": "SMS channel is not trusted under the SIM-channel-compromise hypothesis."
    }
  ],
  "allowedFactors": ["PASSKEY"],
  "blockedFactors": ["SMS_OTP"],
  "selectedFactor": "PASSKEY",
  "action": "ALLOW_WITH_FACTOR",
  "createdAt": "2026-08-07T12:00:00.000Z"
}
```

Errors: `400 VALIDATION_ERROR`, `409 CONFLICT` (duplicate client transaction ID).

### `GET /api/v1/decisions/:decisionId`

Retrieve a persisted decision and its factor evaluations.

```text
GET /api/v1/decisions/dec_0001
```

Response `200` has the same shape as the create response above. Errors:
`404 NOT_FOUND`.

### `GET /api/v1/decisions/:decisionId/audit`

Ordered audit events for a decision (append-only, oldest first).

```text
GET /api/v1/decisions/dec_0001/audit
```

```json
[
  {
    "id": "aud_0001",
    "decisionId": "dec_0001",
    "eventType": "DECISION_CREATED",
    "reasonCode": "decision_recorded",
    "details": { "riskLevel": "HIGH", "threatType": "SIM_CHANNEL_COMPROMISE" },
    "createdAt": "2026-08-07T12:00:00.100Z"
  },
  {
    "id": "aud_0002",
    "decisionId": "dec_0001",
    "eventType": "FACTOR_BLOCKED",
    "reasonCode": "sim_channel_compromise",
    "details": { "factor": "SMS_OTP" },
    "createdAt": "2026-08-07T12:00:00.110Z"
  }
]
```

Errors: `404 NOT_FOUND`.

### `POST /api/v1/challenges`

Create an expiring one-time challenge for a selected or allowed factor. Blocked
and unavailable factors are rejected — this is the policy-enforcement proof
point.

```text
POST /api/v1/challenges
Content-Type: application/json
```

```json
{ "decisionId": "dec_0001", "factor": "PASSKEY" }
```

Response `201`:

```json
{
  "challengeId": "ch_0001",
  "factor": "PASSKEY",
  "mode": "SIMULATED",
  "expiresAt": "2026-08-07T12:05:00.000Z"
}
```

Errors: `400 VALIDATION_ERROR`, `404 NOT_FOUND` (decision),
`409 POLICY_REJECTION` (blocked or unavailable factor).

### `POST /api/v1/challenges/:challengeId/verify`

Verify a challenge. Rejects missing, expired, consumed, and
decision-mismatched challenges; marks the challenge consumed and updates the
transaction state in the same database transaction.

```text
POST /api/v1/challenges/ch_0001/verify
Content-Type: application/json
```

```json
{ "response": { "simulatedOk": true } }
```

Response `200`:

```json
{
  "challengeId": "ch_0001",
  "verified": true,
  "transactionStatus": "AUTHORIZED"
}
```

Errors: `400 VALIDATION_ERROR`, `409 CHALLENGE_ERROR` (missing, expired,
consumed, or replay).

### `GET /api/v1/demo/users`

Synthetic demo identity presets (users, devices, passkey enrollment) for the
frontend forms.

### `POST /api/v1/demo/reset`

Reset only synthetic demo data. Disabled outside demo mode.

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
