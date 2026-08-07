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
   two hero scenarios, and complete the selected factor through a **real
   WebAuthn passkey ceremony** when a credential is registered — otherwise
   through a **clearly labeled simulated passkey adapter** (automatic
   fallback, never hidden).
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
        factor_evaluations · challenges · audit_events ·
        passkey_credentials (public data only) · passkey_registrations
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
npm run check        # typecheck + 125 unit/API tests + production build
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
7. **Continue with passkey** — the challenge comes back `WEBAUTHN` when a real
   credential is registered (run the browser ceremony) or `SIMULATED` (the
   labeled fallback). Watch the transaction authorize and `CHALLENGE_VERIFIED`
   land in the audit trail.
8. Switch the customer to one without a passkey and rerun — the service
   returns **assisted recovery** instead of falling back to SMS.
9. Reset with one click; the database returns to the deterministic seed.

### Real WebAuthn (Phase 7 stretch)

- **Enroll passkey** runs a real registration ceremony and persists only
  public credential data (credential id, COSE public key, counter, transports).
- Challenge creation runs a real ceremony **only** when the user has a
  registered credential and the origin is a WebAuthn-capable secure context
  (https or localhost). Otherwise the PASSKEY adapter automatically returns
  the labeled `SIMULATED` fallback — the challenge `mode` field makes the
  choice explicit, and the UI labels it.
- Registration and authentication are demo-gated and bound to the exact
  request origin (RP id derived from the `Origin` header, default
  `http://localhost:5173`).

See `docs/demo-script.md` for the full script and `docs/API.md` for the
endpoints.

## Explicit non-goals

- No real fraud detection: indicators are synthetic and visibly labeled.
- No live carrier, UPI, Account Aggregator, IP-reputation, or device-risk
  integration — providers are deterministic mock adapters behind a real
  contract (`docs/signal-seams.md` documents where real adapters connect).
- No real SMS delivery, and no production passkey infrastructure: WebAuthn
  runs on the demo origin for the demo users, with the simulated adapter as
  the clearly labeled automatic fallback (docs/EXECUTION.md Phase 7 kill
  criteria honored — the decision, persistence, and audit path never depend on
  the browser ceremony).
- No calibrated probabilities — support bands only.
- No claims of compliance or production readiness.

## Security boundaries

- Input and output are runtime-validated against frozen Zod contracts.
- Blocked/unavailable factors cannot create challenges; challenges are
  one-time, expiring, and replay-safe.
- Decision creation, challenge verification, and demo reset are each atomic
  database transactions; the audit log is append-only through application code.
- WebAuthn verification enforces challenge, origin, relying-party id, and
  credential ownership; signature counters advance to defeat replay.
- Payload limits, rate limiting, CORS restricted to the configured origin,
  and correlation IDs on requests and errors (docs/EXECUTION.md Phase 8).
- No OTPs, passkey private keys, biometric data, or secrets are ever stored.
