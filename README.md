# Threat-Aware MFA Decision Service

**Risk tells you how worried to be. Threat context tells you what not to trust.**

A backend-first transaction authentication decision prototype for a hackathon.
A React client submits transactions through a REST API; the backend evaluates
risk, a narrow threat hypothesis, and factor eligibility, persists an auditable
decision, and executes the selected authentication factor through an adapter.

The judged thesis:

> Most risk systems decide **how much** authentication is required. This
> service also decides **which** authentication factors should not be trusted
> for the suspected attack path.

## The problem

A payment can be correctly classified as high risk while still receiving an
inappropriate authentication challenge. If the risk is driven by a recent SIM
change, sending an SMS OTP routes the challenge through the channel under
suspicion. A scalar score describes severity but loses the reason behind it —
so a severity-only policy cannot express that the SMS channel itself is now
distrusted.

## What this service does

1. Accepts a transaction plus session, account, device, and telecom signals
   through `POST /api/v1/decisions`.
2. Produces deterministic **risk** (LOW/MEDIUM/HIGH), **threat**
   (SIM_CHANNEL_COMPROMISE / PHISHING / INSUFFICIENT_EVIDENCE), and
   **factor-eligibility** decisions.
3. Stores the transaction, normalized signals (with provenance), decision,
   factor evaluations, and audit events **atomically** in SQLite.
4. Lets the React client submit transactions, inspect decisions, compare the
   two hero scenarios, and complete the selected factor through a **clearly
   labeled simulated passkey adapter**.
5. Enforces policy at the API boundary: a blocked or unavailable factor can
   never create a challenge — even with a direct API call.

## Architecture

```
apps/
  web/    React + Vite + TypeScript client (no decision logic)
  api/    Express + TypeScript API, better-sqlite3 persistence
packages/
  contracts/      frozen Zod wire contracts (request/response/challenge/audit)
  decision-core/  pure risk, threat, and policy engines + scalar baseline
  demo-data/      deterministic synthetic fixtures
scripts/
  smoke.ts        end-to-end demo path check (npm run smoke)
docs/             API reference, decisions, demo script, signal seams
```

```
React client
   │  POST /api/v1/decisions
   ▼
Backend API (apps/api)
   │  validation → entity upsert
   │  → signal providers (mock, tagged synthetic, demo overrides)
   │  → Risk Engine      → LOW | MEDIUM | HIGH
   │  → Threat Engine    → SIM_CHANNEL_COMPROMISE | PHISHING | INSUFFICIENT_EVIDENCE
   │  → Policy Engine    → allowedFactors / blockedFactors / action
   │  → one SQLite transaction
   ▼
SQLite  users · devices · sessions · transactions · signals · decisions ·
        factor_evaluations · challenges · audit_events
```

## Setup

Prerequisites: Node.js 20+ and npm.

```bash
npm install
npm run dev          # API on :4000, client on :5173
```

Open http://localhost:5173. The Vite dev server proxies `/api` to the API.

Quality gates:

```bash
npm run check        # typecheck + 108 unit/API tests + production build
npm run smoke        # end-to-end demo path: PASS/FAIL on a fresh database
npm run db:migrate   # apply SQL migrations to data/threat-aware-mfa.db
```

## Demo (2 minutes)

1. Click **SIM swap** — a ₹50,000 transaction with a recent SIM change.
2. The backend returns HIGH risk, SIM-channel-compromise hypothesis, passkey
   allowed, **SMS OTP blocked** with its exact reason.
3. Open the audit timeline: the persisted reasons and policy version.
4. Click **Phishing relay** — same risk, different threat, different reason
   SMS is blocked.
5. Compare both backend decision IDs side by side under the **SAME RISK**
   banner; the scalar baseline shows the shared severity-only requirement.
6. Try **SMS OTP (blocked)** — the API rejects the challenge with
   `POLICY_REJECTION` (the enforcement proof).
7. **Continue with passkey** — create and verify a SIMULATED challenge, watch
   the transaction authorize, and see `CHALLENGE_VERIFIED` in the audit trail.
8. Switch the customer to one without a passkey and rerun — the service
   returns **assisted recovery** instead of falling back to SMS.
9. Reset with one click; the database returns to the deterministic seed.

See `docs/demo-script.md` for the full script and `docs/API.md` for the
endpoints.

## Explicit non-goals

- No real fraud detection: indicators are synthetic and visibly labeled.
- No live carrier, UPI, Account Aggregator, IP-reputation, or device-risk
  integration — providers are deterministic mock adapters behind a real
  contract (`docs/signal-seams.md` documents where real adapters connect).
- No real SMS delivery and no real WebAuthn — the factor path is a labeled
  simulated adapter (real WebAuthn is a stretch phase with kill criteria).
- No calibrated probabilities — support bands only.
- No claims of compliance or production readiness.

## Security boundaries

- Input and output are runtime-validated against frozen Zod contracts.
- Blocked/unavailable factors cannot create challenges; challenges are
  one-time, expiring, and replay-safe.
- Decision creation, challenge verification, and demo reset are each atomic
  database transactions; the audit log is append-only through application code.
- Payload limits, rate limiting, CORS restricted to the configured origin,
  and correlation IDs on requests and errors (docs/EXECUTION.md Phase 8).
- No OTPs, passkey private keys, biometric data, or secrets are ever stored.
