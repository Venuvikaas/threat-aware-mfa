# Threat-Aware MFA Decision Service

**Risk tells you how worried to be. Threat context tells you what not to trust.**

A backend-first transaction authentication decision prototype for a hackathon.
A React client submits transactions through a REST API; the backend evaluates
risk, independent threat hypotheses, ordinal trust across explicit trust
domains, and factor eligibility, persists the full reasoning chain (with a
structured causality trace), and executes the selected authentication factor
through an adapter. Decisions can be replayed and diffed; remediation is
never claimed without replay verification.

The judged thesis:

> Most risk systems decide **how much** authentication is required. This
> service also decides **which** authentication factors should not be trusted
> for the suspected attack path — and it derives that from what each factor
> depends on, not from hardcoded threat-factor pairs.

## The problem

A payment can be correctly classified as high risk while still receiving an
inappropriate authentication challenge. If the risk is driven by a recent SIM
change, sending an SMS OTP routes the challenge through the channel under
suspicion. A scalar score describes severity but loses the reason behind it —
so a severity-only policy cannot express that the SIM channel itself is now
distrusted.

This service answers the additional question: **which trust dependencies were
weakened by the observed threats, and which factors remain eligible as a
result?**

```text
SIM-channel-compromise evidence
  -> SIM ownership becomes DISTRUSTED
  -> SMS OTP requires SIM ownership >= TRUSTED
  -> SMS OTP becomes INELIGIBLE
```

The engine contains no rule like "if threat is SIM swap, block SMS". It models
evidence, threats, trust impacts, and factor dependencies declaratively, and
the generic evaluator derives eligibility.

## What this service does

1. Accepts a transaction plus session context through `POST /api/v1/decisions`
   with evidence overrides (demo mode) for the judged scenarios.
2. Produces deterministic **risk** (LOW/MEDIUM/HIGH), **independent threat
   assessments** (SIM_CHANNEL_COMPROMISE / PHISHING_RELAY /
   DEVICE_INTEGRITY_CONCERN), **ordinal trust states** across explicit trust
   domains, and **factor evaluations** (ELIGIBLE / INELIGIBLE / UNAVAILABLE).
3. Persists the transaction, normalized evidence (with full provenance:
   provider, observation time, quality, synthetic status), threats, trust,
   factors, and the append-only rule trace **atomically** in SQLite, pinned to
   an immutable, content-hashed policy version.
4. Lets the React client submit transactions, inspect decisions side by side,
   open the causality trace, inspect every factor's failed requirements, and
   complete the selected factor through a **real WebAuthn passkey ceremony**
   when a credential is registered — otherwise through a **clearly labeled
   simulated passkey adapter** (automatic fallback, never hidden).
5. Enforces policy at the API boundary: a blocked or unavailable factor can
   never create a challenge — even with a direct API call.
6. Replays any persisted decision (exact for determinism proof, forked with
   evidence/capability changes for counterfactuals) and returns a structured
   semantic diff separated by section.
7. Verifies remediation by replay: the factor inspector only ever claims
   "would become eligible" / "would be selected" when replay proves it.

## Architecture

```
apps/
  web/    React + Vite + TypeScript client (no decision logic)
  api/    Express + TypeScript API, better-sqlite3 persistence
packages/
  contracts/      frozen Zod wire contracts (evidence/threats/trust/factors/
                  policy/trace/decisions/replay/passkeys)
  decision-core/  pure engines: normalizeEvidence, assessThreats, assessTrust,
                  evaluateFactors, selectFactor, buildTrace, assessRisk,
                  evaluateDecision, diffDecisions, verifyRemediation
  policy-bundles/ declarative immutable demo policy v1.0.0 (hash-verified)
  demo-data/      deterministic synthetic fixtures + judge scenario presets
scripts/
  smoke.ts        end-to-end smoke gate (npm run smoke)
docs/             API reference, decisions, threat model, demo script,
                  execution plan, claim boundaries, signal seams
```

```
React client
   │  POST /api/v1/decisions
   ▼
Backend API (apps/api)
   │  validation → entity upsert
   │  → evidence providers (mock, tagged synthetic, demo overrides)
   │  → Risk Engine       → LOW | MEDIUM | HIGH
   │  → Threat Engine     → independent hypotheses with evidence refs
   │  → Trust Engine      → ordinal states across trust domains
   │  → Factor Engine     → declarative dependencies + capability/assurance gates
   │  → Selection         → lowest friction among eligible
   │  → structured causality trace (append-only)
   │  → one SQLite transaction
   ▼
SQLite  users · devices · sessions · transactions · evidence_items ·
        policy_bundles (hash-verified) · decisions · threat/trust/factor
        assessments · trace_events · challenges · replays · decision_diffs ·
        verified_remediations · passkey_credentials (public data only)
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
npm run check        # typecheck + unit/API tests + production build
npm run smoke        # end-to-end smoke gate: PASS/FAIL on a fresh database
npm run db:migrate   # apply SQL migrations to data/threat-aware-mfa.db
```

## Demo (2 minutes)

1. Click **SIM swap** — a ₹50,000 transaction with a recent SIM change.
2. The backend returns HIGH risk, SIM-channel-compromise support STRONG, SIM
   ownership DISTRUSTED, **SMS OTP INELIGIBLE** with its exact failed
   requirement, and passkey selected.
3. Open the **causality trace**: evidence → threat → trust → eligibility →
   selection, every step citing the rule and references that produced it.
4. Click **Phishing relay** — the same ₹50,000 risk level, but a different
   trust effect (telecom delivery distrusted, SIM ownership stays trusted)
   and different activated rules.
5. Try **SMS OTP (blocked)** — the API rejects the challenge with
   `POLICY_REJECTION` (the server-enforcement proof).
6. **Continue with passkey** — the challenge comes back `WEBAUTHN` when a real
   credential is registered (run the browser ceremony) or `SIMULATED` (the
   labeled fallback). Watch the transaction authorize and the outcome trace
   event land in the audit trail.
7. Run **Exact replay** on the SIM decision — the produced decision is
   semantically identical (determinism proof).
8. Run **Fork: passkey → off** — threat and SIM trust stay unchanged, passkey
   becomes UNAVAILABLE, outcome becomes assisted recovery, and the diff shows
   exactly which sections changed.
9. Open the passkey factor inspector in the capability-constrained scenario —
   the **verified remediation** reads "enroll a passkey → would be selected",
   proven by replay.
10. Reset with one click; the database returns to the deterministic seed.

### Real WebAuthn (stretch)

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
  the clearly labeled automatic fallback (the decision, persistence, and
  audit path never depend on the browser ceremony).
- No calibrated probabilities and no percentage trust scores — support bands
  and ordinal states only.
- No claims of compliance or production readiness.

## Security boundaries

- Input and output are runtime-validated against frozen Zod contracts.
- Blocked/unavailable factors cannot create challenges; challenges are
  one-time, expiring, and replay-safe.
- Decision creation, replay creation, challenge verification, and demo reset
  are each atomic database transactions; trace events are append-only.
- Policy bundles are immutable and content-hash verified on every load.
- Replays never mutate the original decision and link to it for lineage.
- Remediation is never emitted without replay verification.
- WebAuthn verification enforces challenge, origin, relying-party id, and
  credential ownership; signature counters advance to defeat replay.
- Payload limits, rate limiting, CORS restricted to the configured origin,
  and correlation IDs on requests and errors (EXECUTION.md Phase 8).
- No OTPs, passkey private keys, biometric data, or secrets are ever stored.
