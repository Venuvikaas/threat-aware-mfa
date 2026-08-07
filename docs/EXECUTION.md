# Threat-Aware MFA Decision Service - Execution Framework & Mega Checklist

#### Solo developer · 12-hour hackathon build · deployable vertical slice · one commit per completed box

This document replaces the frontend-only simulator plan with a **backend-first product prototype**. The system receives transaction and session signals through an API, evaluates risk and likely threat, applies authentication policy, stores an auditable decision, and returns the allowed and blocked authentication factors to a React client.

The goal is not to imitate a production bank stack. The goal is to ship the smallest credible system that demonstrates a real integration boundary, stateful decisions, explainable policy enforcement, and one working authentication path without hiding behind static UI fixtures.

---

## How to read this

- **[API]** Backend endpoint or transport work
- **[ENGINE]** Risk, threat, or policy decision logic
- **[DATA]** Database, repository, seed, or audit work
- **[WEB]** React frontend work
- **[AUTH]** Authentication-factor execution
- **[TEST]** Automated or manual verification
- **[DEMO]** Judged experience and presentation reliability
- **[DOCS]** README, decisions, API contract, and demo script
- **🔴 BLOCKING** Complete before dependent work begins
- **🟡 STRETCH** Attempt only after the complete critical path passes
- **✂ KILL** Remove when its stated condition is reached
- **🔗 CONTRACT** Freeze the interface before parallel implementation

Every checked box should leave the repository runnable and end with the suggested commit.

---

# PART 1 - Product boundary

## 1. What this project is

A transaction authentication decision service with four user-visible capabilities:

1. Accept a transaction plus realistic session, account, device, and telecom indicators through a REST API.
2. Produce deterministic risk, threat, and factor-eligibility decisions.
3. Store the decision and reason trace in an audit log.
4. Let a React frontend submit transactions, inspect decisions, and complete a selected factor through a safe demo adapter.

Core system flow:

```text
React Client
    |
    | POST /api/v1/decisions
    v
Backend API
    |
    +--> Input validation and signal normalization
    |
    +--> Risk Engine
    |       -> LOW | MEDIUM | HIGH
    |
    +--> Threat Engine
    |       -> SIM_CHANNEL_COMPROMISE
    |       -> PHISHING
    |       -> INSUFFICIENT_EVIDENCE
    |
    +--> Policy Engine
    |       -> allowedFactors
    |       -> blockedFactors
    |       -> final action
    |
    +--> SQLite
            -> users
            -> devices
            -> sessions
            -> transactions
            -> decisions
            -> audit events
```

Optional factor execution, isolated from the decision path:

```text
Selected PASSKEY
    |
    +--> Preferred stretch: real WebAuthn ceremony
    |
    +--> Required fallback: explicit simulated verification adapter
```

## 2. What makes this a product rather than a research demo

- The frontend consumes a real backend contract.
- The backend owns decisions and state.
- Signals enter through an API rather than being hardcoded into rendered components.
- Decisions are persisted and can be retrieved later.
- Policy outputs are machine-readable and suitable for integration.
- Authentication factors are represented as executable adapters, even if only one demo adapter is implemented.
- Audit records show exactly why a factor was allowed or blocked.

## 3. What this project still does not claim

- It does not detect real fraud from production data.
- It does not connect to a bank, UPI network, Account Aggregator, telecom operator, or credit bureau.
- It does not claim calibrated risk probabilities.
- It does not claim compliance or production readiness.
- It does not use real money.
- It does not implement customer recovery.
- It does not prove that a passkey defeats every device-compromise scenario.
- Mock signal providers simulate upstream contracts and must be visibly labeled.

## 4. Judge-facing thesis

> Most risk systems decide how much authentication is required. This service also decides which authentication factors should not be trusted for the suspected attack path.

---

# PART 2 - Ruthless architecture

## 1. Selected stack

### Frontend

- React
- Vite
- TypeScript
- Native CSS or an already-installed lightweight utility layer

### Backend

- Node.js
- Fastify or Express with TypeScript
- Zod for request and response validation

Use Fastify if the developer is already comfortable with it. Otherwise use Express. Do not spend build time comparing frameworks.

### Data

- SQLite
- Prisma only if the developer already knows its migration flow
- Otherwise use `better-sqlite3` with explicit SQL migrations

### Testing

- Vitest for engine and API tests
- Supertest when using Express, or Fastify injection when using Fastify

### Authentication

- Required: deterministic simulated factor adapter
- Stretch: SimpleWebAuthn browser and server packages

## 2. Rejected infrastructure

Do not add:

- NestJS unless the repository already uses it
- Redis
- queues
- microservices
- Kafka
- Docker Compose
- Kubernetes
- event buses
- separate risk, threat, and policy deployments
- cloud databases
- OAuth providers
- LLM APIs
- vector databases
- native device fingerprinting SDKs
- live telecom, UPI, Account Aggregator, or IP-reputation integrations

The backend is a modular monolith. Risk, threat, policy, factor adapters, and persistence are separate modules in one process.

## 3. Why no Redis

The demo has one process, one database, no distributed lock requirement, no background job, and no cross-instance session problem. SQLite-backed challenge and session state is sufficient.

## 4. Why mock signal providers are acceptable

The service must demonstrate the **contract** by which real providers would deliver signals. Provider adapters return deterministic data with explicit provenance:

```json
{
  "name": "sim_change_status",
  "value": true,
  "source": "mock_telco_adapter",
  "observedAt": "2026-08-07T12:00:00.000Z",
  "synthetic": true
}
```

The backend must not pretend it discovered these signals independently.

## 5. System modules

```text
apps/
  web/
  api/
packages/
  contracts/
  decision-core/
  demo-data/
docs/
```

Backend modules:

```text
api/src/
  routes/
  services/
    decisionService.ts
  engines/
    riskEngine.ts
    threatEngine.ts
    policyEngine.ts
  providers/
    signalProvider.ts
    mockSignalProvider.ts
  factors/
    factorAdapter.ts
    simulatedPasskeyAdapter.ts
    webauthnAdapter.ts        # stretch only
  repositories/
    userRepository.ts
    transactionRepository.ts
    decisionRepository.ts
    auditRepository.ts
  db/
    migrations/
    connection.ts
  app.ts
  server.ts
```

---

# PART 3 - Frozen contracts 🔗

## 1. Decision request

```ts
interface CreateDecisionRequest {
  userId: string;
  transaction: {
    clientTransactionId: string;
    amountMinor: number;
    currency: "INR";
    payeeId: string;
    payeeIsKnown: boolean;
  };
  session: {
    sessionId: string;
    ageSeconds: number;
    failedLoginCount: number;
    ipAddress: string;
    asn: string;
    country: string;
  };
  device: {
    deviceId: string;
    trusted: boolean;
    firstSeen: boolean;
    browserFingerprint: string;
  };
  signals: {
    recentSimChange: boolean | null;
    geoDistanceFromLastLoginKm: number | null;
    phishingRelayIndicator: boolean;
  };
}
```

## 2. Decision response

```ts
type RiskLevel = "LOW" | "MEDIUM" | "HIGH";

type ThreatType =
  | "SIM_CHANNEL_COMPROMISE"
  | "PHISHING"
  | "INSUFFICIENT_EVIDENCE";

type FactorId = "PASSKEY" | "SMS_OTP";

type DecisionAction =
  | "ALLOW_WITH_FACTOR"
  | "REFER_TO_ASSISTED_RECOVERY";

interface FactorDecision {
  factor: FactorId;
  status: "ALLOWED" | "BLOCKED" | "UNAVAILABLE";
  reasonCode: string;
  reason: string;
}

interface CreateDecisionResponse {
  decisionId: string;
  transactionId: string;
  policyVersion: string;
  risk: {
    level: RiskLevel;
    reasons: string[];
  };
  threat: {
    type: ThreatType;
    support: "HIGH" | "MODERATE" | "INSUFFICIENT";
    evidence: string[];
  };
  factors: FactorDecision[];
  allowedFactors: FactorId[];
  blockedFactors: FactorId[];
  selectedFactor: FactorId | null;
  action: DecisionAction;
  createdAt: string;
}
```

## 3. Factor challenge contract

```ts
interface CreateChallengeRequest {
  decisionId: string;
  factor: FactorId;
}

interface CreateChallengeResponse {
  challengeId: string;
  factor: FactorId;
  mode: "SIMULATED" | "WEBAUTHN";
  expiresAt: string;
  publicOptions?: unknown;
}

interface VerifyChallengeRequest {
  challengeId: string;
  response: unknown;
}

interface VerifyChallengeResponse {
  challengeId: string;
  verified: boolean;
  transactionStatus: "AUTHORIZED" | "DENIED" | "PENDING_RECOVERY";
}
```

## 4. Audit event contract

```ts
interface AuditEvent {
  id: string;
  decisionId: string;
  eventType:
    | "DECISION_CREATED"
    | "FACTOR_BLOCKED"
    | "FACTOR_SELECTED"
    | "CHALLENGE_CREATED"
    | "CHALLENGE_VERIFIED"
    | "RECOVERY_REQUIRED";
  reasonCode: string;
  details: Record<string, unknown>;
  createdAt: string;
}
```

## 5. Contract rules

- API input and output are runtime-validated.
- Money is stored as integer minor units.
- IDs are server-generated except client transaction ID, session ID, and device ID.
- Server time owns `createdAt`, expiry, and audit timestamps.
- The frontend never calculates risk, threat, or factor eligibility.
- The frontend never decides whether a factor is allowed.
- An unavailable or blocked factor cannot create a challenge.
- Repeated use of the same client transaction ID must not silently create conflicting decisions.
- Every decision stores policy version and normalized evidence.
- Synthetic provider data is tagged as synthetic in storage and in the UI.

---

# PART 4 - Data model

## 1. Minimum tables

### users

```text
id
name
account_created_at
passkey_enrolled
created_at
```

### devices

```text
id
user_id
trusted
browser_fingerprint
first_seen_at
last_seen_at
```

### sessions

```text
id
user_id
device_id
ip_address
asn
country
started_at
failed_login_count
```

### transactions

```text
id
client_transaction_id
user_id
amount_minor
currency
payee_id
payee_is_known
status
created_at
```

### signals

```text
id
transaction_id
name
value_json
source
synthetic
observed_at
```

### decisions

```text
id
transaction_id
risk_level
risk_reasons_json
threat_type
threat_support
threat_evidence_json
allowed_factors_json
blocked_factors_json
selected_factor
action
policy_version
created_at
```

### factor_evaluations

```text
id
decision_id
factor
status
reason_code
reason
```

### challenges

```text
id
decision_id
factor
mode
challenge_data_json
expires_at
consumed_at
verified
created_at
```

### audit_events

```text
id
decision_id
event_type
reason_code
details_json
created_at
```

## 2. Database rules

- SQLite foreign keys enabled.
- Transaction and decision creation occur in one database transaction.
- Challenge verification marks the challenge consumed in the same transaction that updates transaction status.
- A consumed or expired challenge cannot verify again.
- The audit log is append-only through application code.
- Store synthetic demo users only.
- Do not store OTPs, passkey private keys, raw biometric data, or secrets.

---

# PART 5 - Decision logic

## 1. Risk engine

The risk engine creates a categorical output from explicit demonstration rules. It does not generate a fake probability.

Suggested high-risk triggers:

- amount at or above configured high-value threshold,
- recent SIM change,
- first-seen device,
- large geo distance,
- repeated failed logins,
- phishing-relay indicator,
- new payee combined with another major indicator.

The output contains the risk level and exact rule reasons.

## 2. Threat engine

Support only narrow, defensible hypotheses:

### SIM_CHANNEL_COMPROMISE

Required primary evidence:

- `recentSimChange === true`

Supporting context may increase `support` from moderate to high:

- first-seen device,
- new payee,
- high-value transfer.

### PHISHING

Required primary evidence:

- `phishingRelayIndicator === true`

Supporting context:

- unusual or first-seen session,
- new payee,
- recent failed logins.

### INSUFFICIENT_EVIDENCE

Use when:

- neither primary indicator exists,
- primary signals conflict,
- required signal is unavailable and no safe hypothesis can be selected.

No normalized probability vector is allowed.

## 3. Policy engine

Policy evaluation order:

1. Load user factor enrollment.
2. Load required assurance from transaction policy.
3. Block threat-incompatible factors.
4. Mark unenrolled factors unavailable.
5. Retain factors meeting the assurance requirement.
6. Select the first allowed factor in fixed preference order.
7. If none survives, return assisted recovery.

Required demonstration policies:

- SIM channel compromise blocks SMS OTP.
- Phishing blocks SMS OTP as relayable under this narrow policy.
- Passkey is allowed for these two supported hypotheses only when enrolled.
- Insufficient evidence never silently produces a confident factor recommendation. Use a conservative factor policy or assisted recovery, documented in `DECISIONS.md`.

## 4. Fair baseline

A separate baseline function receives only:

- risk level,
- required assurance,
- factor enrollment.

It returns the same high-level requirement for equal-risk transactions. It does not receive threat indicators and is not configured to fail deliberately.

The UI uses the baseline only to show information loss, not to claim that all existing systems are naive.

---

# PART 6 - REST API

## Required endpoints

```text
GET    /health
POST   /api/v1/decisions
GET    /api/v1/decisions/:decisionId
GET    /api/v1/decisions/:decisionId/audit
POST   /api/v1/challenges
POST   /api/v1/challenges/:challengeId/verify
GET    /api/v1/demo/users
POST   /api/v1/demo/reset
```

## Endpoint behavior

### GET /health

Returns process and database health. No deep external checks because there are no external providers.

### POST /api/v1/decisions

- Validate request.
- Load or create synthetic demo entities.
- Normalize and persist signals.
- Evaluate risk.
- Evaluate threat.
- Evaluate factors.
- Persist transaction, decision, factor evaluations, and audit events atomically.
- Return the complete decision response.

### GET /api/v1/decisions/:decisionId

Returns the persisted decision and factor evaluations.

### GET /api/v1/decisions/:decisionId/audit

Returns ordered audit events for the decision.

### POST /api/v1/challenges

- Verify the decision exists.
- Verify the requested factor is selected or allowed.
- Reject blocked or unavailable factors.
- Create an expiring one-time challenge.

### POST /api/v1/challenges/:challengeId/verify

- Reject missing, expired, consumed, or decision-mismatched challenges.
- Invoke the registered factor adapter.
- Mark challenge consumed.
- Update transaction state.
- Append audit event.

### POST /api/v1/demo/reset

Resets only synthetic demo data. It must be disabled outside demo mode.

---

# PART 7 - Mega checklist

## ☐ PHASE 0 - Repository and contracts 🔴 BLOCKING

- [ ] **[DOCS]** Add the revised product boundary to `docs/DECISIONS.md`.  
  Commit: `docs: pivot to backend decision service`

- [ ] **[DOCS]** Record what remains simulated and why.  
  Commit: `docs: define synthetic signal boundary`

- [ ] **[API]** Create workspace structure for `apps/web`, `apps/api`, and shared packages.  
  Commit: `chore: scaffold full stack workspace`

- [ ] **[API]** Add root scripts for dev, test, type-check, build, and full check.  
  Commit: `chore: add workspace scripts`

- [ ] **[API]** 🔗 Freeze request, response, challenge, and audit contracts in `packages/contracts`.  
  Commit: `feat(contracts): freeze api contracts`

- [ ] **[TEST]** Add contract validation tests for valid and invalid payloads.  
  Commit: `test(contracts): validate api payloads`

- [ ] **[DOCS]** Create `docs/API.md` with endpoint examples and error shapes.  
  Commit: `docs: add api contract reference`

### Exit gate

- [ ] Web and API packages start independently.
- [ ] Shared contracts compile in both packages.
- [ ] No decision logic exists in the frontend.
- [ ] No unapproved infrastructure dependency is installed.

---

## ☐ PHASE 1 - Database and backend spine 🔴 BLOCKING

- [ ] **[DATA]** Configure SQLite connection and enable foreign keys.  
  Commit: `feat(data): initialize sqlite database`

- [ ] **[DATA]** Create schema migrations for all minimum tables.  
  Commit: `feat(data): add core database schema`

- [ ] **[DATA]** Add seed migration for one synthetic user, one trusted device, one new device, and passkey enrollment state.  
  Commit: `feat(data): seed demo identities`

- [ ] **[DATA]** Implement repositories for users, transactions, decisions, factor evaluations, challenges, and audit events.  
  Commit: `feat(data): add persistence repositories`

- [ ] **[API]** Add structured JSON error response middleware.  
  Commit: `feat(api): add consistent error handling`

- [ ] **[API]** Implement `GET /health` with database access check.  
  Commit: `feat(api): add health endpoint`

- [ ] **[TEST]** Test migration, seed, repository round trip, foreign keys, and health endpoint.  
  Commit: `test(data): verify database spine`

### Exit gate

- [ ] Fresh database migration succeeds.
- [ ] Seed is deterministic.
- [ ] Health endpoint confirms database access.
- [ ] Repository tests pass.

---

## ☐ PHASE 2 - Decision engines 🔴 BLOCKING

### Risk engine

- [ ] **[ENGINE]** Define versioned risk policy with categorical thresholds and reason codes.  
  Commit: `feat(engine): define risk policy`

- [ ] **[ENGINE]** Implement pure risk evaluation.  
  Commit: `feat(engine): evaluate transaction risk`

- [ ] **[TEST]** Cover low, medium, high, threshold boundary, and missing-signal cases.  
  Commit: `test(engine): cover risk evaluation`

### Threat engine

- [ ] **[ENGINE]** Define narrow SIM-channel and phishing hypotheses.  
  Commit: `feat(engine): define threat hypotheses`

- [ ] **[ENGINE]** Implement pure threat evaluation with support bands and evidence.  
  Commit: `feat(engine): evaluate threat evidence`

- [ ] **[TEST]** Cover SIM change, phishing relay, insufficient evidence, and conflicting evidence.  
  Commit: `test(engine): cover threat evaluation`

### Policy engine

- [ ] **[ENGINE]** Define SMS OTP and passkey properties, assurance, enrollment requirements, and preference order.  
  Commit: `feat(engine): define authentication factors`

- [ ] **[ENGINE]** Implement factor evaluation states: allowed, blocked, unavailable.  
  Commit: `feat(engine): evaluate factor eligibility`

- [ ] **[ENGINE]** Implement selected factor and assisted-recovery outcome.  
  Commit: `feat(engine): select authentication outcome`

- [ ] **[TEST]** Prove blocked and unavailable factors can never be selected.  
  Commit: `test(engine): enforce factor invariants`

- [ ] **[ENGINE]** Implement fair scalar baseline as a separate pure function.  
  Commit: `feat(engine): add scalar baseline`

- [ ] **[TEST]** Prove baseline input excludes threat evidence.  
  Commit: `test(engine): constrain baseline contract`

### Exit gate

- [ ] Engines are deterministic pure functions.
- [ ] No fake probability is returned.
- [ ] Every output includes stable reason codes.
- [ ] Equal-risk hero scenarios produce different threat traces.
- [ ] All engine tests pass.

---

## ☐ PHASE 3 - Decision API and audit 🔴 BLOCKING

- [ ] **[API]** Implement request normalization and validation.  
  Commit: `feat(api): normalize decision inputs`

- [ ] **[API]** Implement `decisionService` orchestration.  
  Commit: `feat(api): orchestrate authentication decision`

- [ ] **[DATA]** Persist transaction, signals, decision, factor evaluations, and audit events atomically.  
  Commit: `feat(data): persist complete decision trace`

- [ ] **[API]** Implement `POST /api/v1/decisions`.  
  Commit: `feat(api): create decision endpoint`

- [ ] **[API]** Implement `GET /api/v1/decisions/:decisionId`.  
  Commit: `feat(api): retrieve persisted decision`

- [ ] **[API]** Implement `GET /api/v1/decisions/:decisionId/audit`.  
  Commit: `feat(api): retrieve audit timeline`

- [ ] **[API]** Add idempotency handling for repeated client transaction IDs.  
  Commit: `feat(api): protect duplicate transaction decisions`

- [ ] **[TEST]** API test: SIM-swap request blocks SMS and allows passkey.  
  Commit: `test(api): verify sim swap decision`

- [ ] **[TEST]** API test: phishing request returns phishing-specific reasons.  
  Commit: `test(api): verify phishing decision`

- [ ] **[TEST]** API test: unenrolled passkey causes assisted recovery.  
  Commit: `test(api): verify recovery fallback`

- [ ] **[TEST]** API test: decision is retrievable and audit order is stable.  
  Commit: `test(api): verify persisted audit trace`

### Exit gate

- [ ] A curl request creates a complete decision.
- [ ] The response matches the frozen contract.
- [ ] Database contains the transaction and audit trail.
- [ ] Re-fetch returns the same decision.
- [ ] Duplicate requests do not create conflicting records.

---

## ☐ PHASE 4 - Signal provider boundary 🔴 BLOCKING

- [ ] **[API]** Define `SignalProvider` interface.  
  Commit: `feat(api): define signal provider interface`

- [ ] **[API]** Implement deterministic mock telecom provider for recent SIM change.  
  Commit: `feat(api): add mock telecom signals`

- [ ] **[API]** Implement deterministic mock device and geo provider.  
  Commit: `feat(api): add mock device signals`

- [ ] **[API]** Tag every provider result with source, observed time, and `synthetic: true`.  
  Commit: `feat(api): preserve signal provenance`

- [ ] **[API]** Permit explicit request signals to override mock provider values only in demo mode.  
  Commit: `feat(api): add controlled demo overrides`

- [ ] **[TEST]** Verify provider timeout or failure produces unknown signal, not fabricated safe data.  
  Commit: `test(api): handle unavailable signal provider`

- [ ] **[DOCS]** Document where a real carrier, device-risk, IP-reputation, UPI, or Account Aggregator adapter would connect. Do not claim those integrations exist.  
  Commit: `docs: document production signal seams`

### Exit gate

- [ ] Core decision service uses provider contracts rather than UI fixtures.
- [ ] Every signal has visible provenance.
- [ ] Provider failure is explicit.
- [ ] No live external dependency exists on the demo path.

---

## ☐ PHASE 5 - Frontend integration 🔴 BLOCKING

### Transaction submission

- [ ] **[WEB]** Build transaction form with amount, payee type, device profile, session profile, and threat-signal controls.  
  Commit: `feat(web): add transaction submission form`

- [ ] **[WEB]** Load synthetic user and device presets from the backend.  
  Commit: `feat(web): load demo identity presets`

- [ ] **[WEB]** Submit to `POST /api/v1/decisions`; do not calculate decisions client-side.  
  Commit: `feat(web): request backend decision`

- [ ] **[WEB]** Add loading, validation, backend unavailable, and invalid-response states.  
  Commit: `feat(web): handle decision request states`

### Decision visualization

- [ ] **[WEB]** Display risk level and exact risk reasons.  
  Commit: `feat(web): display risk result`

- [ ] **[WEB]** Display threat type, support band, and evidence.  
  Commit: `feat(web): display threat result`

- [ ] **[WEB]** Display factor cards for allowed, blocked, and unavailable factors.  
  Commit: `feat(web): display factor eligibility`

- [ ] **[WEB]** Display selected factor or assisted recovery outcome.  
  Commit: `feat(web): display policy outcome`

- [ ] **[WEB]** Display policy version and synthetic-signal disclosure.  
  Commit: `feat(web): disclose decision provenance`

- [ ] **[WEB]** Retrieve and render the audit timeline from the audit endpoint.  
  Commit: `feat(web): display persisted audit trail`

### Hero comparison

- [ ] **[WEB]** Add one-click presets for SIM-swap and phishing cases with the same amount and scalar-risk band.  
  Commit: `feat(web): add hero transaction presets`

- [ ] **[WEB]** Add a comparison mode that shows two backend-created decision IDs side by side.  
  Commit: `feat(web): compare backend decisions`

- [ ] **[WEB]** Show the fair scalar baseline as a shared result.  
  Commit: `feat(web): display baseline comparison`

### Exit gate

- [ ] All visible decisions originate from API responses.
- [ ] Browser refresh can retrieve a persisted decision by ID.
- [ ] Hero scenarios are created through the backend.
- [ ] Audit events are loaded from persistence.
- [ ] The UI never implies mock providers are live integrations.

---

## ☐ PHASE 6 - Executable factor adapter 🔴 BLOCKING

### Adapter framework

- [ ] **[AUTH]** Define factor-adapter interface for create challenge and verify.  
  Commit: `feat(auth): define factor adapter contract`

- [ ] **[AUTH]** Implement simulated passkey adapter with explicit `SIMULATED` mode.  
  Commit: `feat(auth): add simulated passkey adapter`

- [ ] **[DATA]** Persist challenges with expiry, consumed state, and decision reference.  
  Commit: `feat(data): persist factor challenges`

- [ ] **[API]** Implement challenge creation endpoint.  
  Commit: `feat(api): create factor challenge`

- [ ] **[API]** Implement challenge verification endpoint.  
  Commit: `feat(api): verify factor challenge`

- [ ] **[API]** Reject challenge creation for blocked or unavailable factors.  
  Commit: `fix(auth): enforce selected factor policy`

- [ ] **[API]** Reject expired and replayed challenges.  
  Commit: `fix(auth): prevent challenge replay`

- [ ] **[DATA]** Append challenge creation and verification audit events.  
  Commit: `feat(data): audit factor execution`

- [ ] **[WEB]** Add `Continue with passkey` action for the selected factor.  
  Commit: `feat(web): launch selected factor challenge`

- [ ] **[WEB]** Clearly label simulated factor execution.  
  Commit: `feat(web): disclose simulated authentication`

- [ ] **[TEST]** Test allowed challenge, blocked-factor rejection, expiry, replay, and transaction-state update.  
  Commit: `test(auth): cover challenge lifecycle`

### Exit gate

- [ ] The selected factor can execute through an adapter.
- [ ] The backend prevents bypassing policy through direct API calls.
- [ ] Challenge state is persisted and replay-safe.
- [ ] The UI explicitly labels simulation.

---

## ☐ PHASE 7 - Real WebAuthn 🟡 STRETCH

Attempt only when Phases 0 through 6 pass and the full fallback demo is stable.

- [ ] **[AUTH]** Add WebAuthn credential table containing public credential data only.  
  Commit: `feat(auth): add webauthn credential storage`

- [ ] **[AUTH]** Add registration-options and registration-verification endpoints.  
  Commit: `feat(auth): add passkey registration`

- [ ] **[AUTH]** Add authentication-options and authentication-verification through the factor adapter.  
  Commit: `feat(auth): add passkey authentication`

- [ ] **[AUTH]** Bind server challenge state to decision ID, transaction ID, and expiry.  
  Commit: `feat(auth): bind passkey challenge to decision`

- [ ] **[TEST]** Verify origin, relying-party ID, expiry, consumed challenge, and credential ownership.  
  Commit: `test(auth): validate webauthn ceremony`

- [ ] **[WEB]** Add passkey enrollment for the synthetic demo user.  
  Commit: `feat(web): enroll demo passkey`

- [ ] **[WEB]** Add real passkey authentication with automatic fallback to the labeled simulated adapter only in demo mode.  
  Commit: `feat(web): execute passkey challenge`

- ✂ KILL real WebAuthn if it requires changing the demo host, browser profile, or critical-path API contracts.
- ✂ KILL real WebAuthn if registration or authentication is not stable on the exact presentation environment.
- ✂ KILL real WebAuthn if fallback labeling becomes ambiguous.

### Exit gate

- [ ] Registration and authentication work on the exact demo origin.
- [ ] Credentials persist for the presentation profile.
- [ ] Failure cannot break the decision or audit demo.
- [ ] Simulated adapter remains a clearly labeled fallback.

---

## ☐ PHASE 8 - Security and reliability hardening 🔴 BLOCKING

- [ ] **[API]** Add payload size limits.  
  Commit: `fix(api): limit request payloads`

- [ ] **[API]** Add basic rate limiting to decision and challenge endpoints.  
  Commit: `fix(api): rate limit critical endpoints`

- [ ] **[API]** Restrict CORS to the configured frontend origin.  
  Commit: `fix(api): restrict cors origin`

- [ ] **[API]** Add correlation ID to request logs and error responses.  
  Commit: `feat(api): add request correlation ids`

- [ ] **[API]** Ensure logs exclude raw credentials, challenge secrets, and unnecessary personal data.  
  Commit: `fix(api): redact sensitive logs`

- [ ] **[DATA]** Verify all multi-write decision and verification flows use database transactions.  
  Commit: `fix(data): enforce atomic state changes`

- [ ] **[TEST]** Test malformed payload, unknown user, unknown device, duplicate transaction, missing signal, provider failure, blocked factor, expired challenge, and replay.  
  Commit: `test: cover critical failure paths`

- [ ] **[TEST]** Configure `npm run check` to run type-check, tests, and builds for all packages.  
  Commit: `chore: add full stack quality gate`

- [ ] **[TEST]** Add smoke script that resets demo data, creates both decisions, retrieves audits, executes the simulated passkey, and prints PASS or FAIL.  
  Commit: `test: add end to end smoke script`

### Exit gate

- [ ] Full check passes.
- [ ] Smoke script passes from a fresh demo database.
- [ ] Direct requests cannot challenge blocked factors.
- [ ] Replays and expired challenges fail.
- [ ] Logs are useful without exposing secrets.

---

## ☐ PHASE 9 - Demo experience and polish 🔴 BLOCKING

- [ ] **[DEMO]** Default landing view explains the product in one sentence.  
  Commit: `style(web): clarify product value`

- [ ] **[DEMO]** Make `same risk` the first comparison anchor.  
  Commit: `style(web): emphasize shared risk`

- [ ] **[DEMO]** Make signal provenance and synthetic labels visible but not dominant.  
  Commit: `style(web): clarify signal provenance`

- [ ] **[DEMO]** Make blocked-factor reasons the main visual proof.  
  Commit: `style(web): emphasize factor decisions`

- [ ] **[DEMO]** Make persisted audit events readable as a compact timeline.  
  Commit: `style(web): polish audit timeline`

- [ ] **[DEMO]** Add a visible API-response inspector or copy-JSON action.  
  Commit: `feat(web): expose machine readable decision`

- [ ] **[DEMO]** Add one-click demo reset backed by the API.  
  Commit: `feat(web): reset deterministic demo data`

- [ ] **[DEMO]** Remove decorative panels without demo value.  
  Commit: `style(web): remove visual noise`

- [ ] **[TEST]** Verify the complete flow without editing query strings, database rows, or source code.  
  Commit: `test: verify judge facing demo path`

### Exit gate

- [ ] A judge can see that the backend returned the decision.
- [ ] A judge can see that the decision was persisted.
- [ ] A judge can see why each factor was allowed or blocked.
- [ ] A judge can execute the selected factor through an adapter.
- [ ] Reset restores deterministic state.

---

## ☐ PHASE 10 - Documentation and submission 🔴 BLOCKING

- [ ] **[DOCS]** Update `README.md` with product, architecture, data flow, setup, API, demo, limitations, and security boundaries.  
  Commit: `docs: write full stack project readme`

- [ ] **[DOCS]** Add architecture diagram showing client, API, engines, providers, factors, and SQLite.  
  Commit: `docs: add system architecture diagram`

- [ ] **[DOCS]** Document every mock provider and the real production seam it represents.  
  Commit: `docs: document integration boundaries`

- [ ] **[DOCS]** Complete `DECISIONS.md` with rejected Redis, microservices, live APIs, and unsupported AI claims.  
  Commit: `docs: finalize architecture decisions`

- [ ] **[DOCS]** Write `docs/demo-script.md`.  
  Commit: `docs: add final product demo script`

- [ ] **[TEST]** Verify clone-to-run instructions on a clean environment.  
  Commit: `test: verify setup runbook`

- [ ] **[TEST]** Scan tracked files and Git history for secrets.  
  Commit: `chore: complete secrets review`

- [ ] **[DEMO]** Capture one backup recording after smoke passes.  
  Commit: `docs: add demo recording reference`

### Exit gate

- [ ] README makes the backend product boundary obvious.
- [ ] API examples match the implementation.
- [ ] Mock versus real boundaries are explicit.
- [ ] Demo script matches the shipped product.
- [ ] No secret or credential is committed.

---

# PART 8 - Demo script skeleton

## Opening hook

> A high-risk score can tell a bank to add authentication. It cannot tell the bank whether the authentication channel itself is compromised.

## Flow

1. Submit a ₹50,000 synthetic transaction through the React client.
2. Show that the request reaches `POST /api/v1/decisions`.
3. Display the backend response: high risk, SIM-channel-compromise hypothesis, passkey allowed, SMS OTP blocked.
4. Open the audit timeline and show the persisted reasons and policy version.
5. Create the phishing scenario with the same risk level.
6. Compare both backend decision IDs side by side.
7. Show that the scalar baseline returns the same high-level requirement while threat-aware reasons differ.
8. Attempt to create an SMS challenge and show the backend rejects the blocked factor.
9. Continue with the selected passkey adapter.
10. Show challenge verification and the authorization audit event.
11. Disable passkey enrollment and rerun the transaction.
12. Show assisted recovery rather than unsafe SMS fallback.

## Wow moment

The strongest moment is not a chart. It is a direct API enforcement proof:

```text
POST /api/v1/challenges
factor = SMS_OTP

-> rejected because the persisted policy decision blocked the channel
```

Then execute the selected passkey adapter successfully.

## Closing

> This is not a static risk dashboard. It is an integration-ready decision service: signals enter through an API, policy is enforced on the server, factor challenges cannot bypass the decision, and every result is auditable.

---

# PART 9 - Kill criteria and cut order

## Immediate kill criteria

- ✂ Remove Redis if proposed.
- ✂ Remove microservice separation if proposed.
- ✂ Remove live carrier, UPI, Account Aggregator, device-intelligence, or IP-reputation integrations if credentials, approvals, or unstable networks are required.
- ✂ Remove real SMS delivery. Never send an actual OTP for this prototype.
- ✂ Remove real WebAuthn before weakening the API, decision, persistence, or audit path.
- ✂ Remove user login before weakening factor-policy enforcement.
- ✂ Remove dashboard analytics before weakening the transaction decision flow.
- ✂ Remove extra threat classes before weakening the two hero scenarios.
- ✂ Remove rich device fingerprinting before weakening signal provenance.
- ✂ Remove deployment automation before weakening local reproducibility.

## Cut order if the build slips

1. Real WebAuthn
2. JSON inspector polish
3. Side-by-side comparison layout; retain sequential scenario history
4. Device and session preset editor; retain two fixed presets from the backend
5. Baseline visualization; retain baseline output in API or demo narration
6. CSS transitions
7. Audit filtering; retain ordered audit list

## Never cut

- Backend decision endpoint
- Runtime request validation
- Pure risk, threat, and policy engines
- SQLite persistence
- Factor-level allowed, blocked, and unavailable decisions
- Audit event storage and retrieval
- Backend rejection of blocked-factor challenge creation
- Simulated passkey adapter
- Two API-driven hero scenarios
- Synthetic-signal disclosure
- Automated smoke test

---

# PART 10 - Definition of done

## Product

- [ ] React submits a transaction to the backend.
- [ ] Backend returns risk, threat, allowed factors, blocked factors, selected factor, action, reasons, and policy version.
- [ ] SIM-change scenario blocks SMS OTP.
- [ ] Phishing scenario blocks SMS OTP for its own documented reason.
- [ ] Passkey is selected only when enrolled and policy-eligible.
- [ ] No surviving factor produces assisted recovery.
- [ ] Frontend retrieves a persisted decision and audit timeline.

## Backend

- [ ] Input and output contracts are runtime-validated.
- [ ] Risk, threat, and policy engines are pure and unit-tested.
- [ ] Decision creation is atomic.
- [ ] Duplicate client transaction handling is defined and tested.
- [ ] Health endpoint verifies database availability.
- [ ] Provider provenance is persisted.

## Authentication enforcement

- [ ] A blocked factor cannot create a challenge.
- [ ] An unavailable factor cannot create a challenge.
- [ ] An allowed selected factor can create a challenge.
- [ ] Expired or consumed challenge verification fails.
- [ ] Successful verification updates transaction state and audit log.
- [ ] Simulated execution is clearly labeled.

## Demo

- [ ] Same-risk hero scenarios are available as one-click presets.
- [ ] Backend response is visible.
- [ ] Audit persistence is visible.
- [ ] SMS challenge rejection is visible.
- [ ] Selected factor execution is visible.
- [ ] Passkey-unavailable recovery path is visible.
- [ ] Demo reset is deterministic.
- [ ] No external API or network dependency can break the core flow.

## Integrity

- [ ] No calibrated-probability claim appears.
- [ ] No live-provider claim appears.
- [ ] No compliance or production-readiness claim appears.
- [ ] No real payment or real customer data is used.
- [ ] No secrets exist in the repository or history.

## Quality gate

- [ ] `npm run check` passes.
- [ ] End-to-end smoke script passes on a fresh database.
- [ ] README setup steps work.
- [ ] Demo script matches the shipped interface and API.
- [ ] Backup recording exists.

---

# PART 11 - Critical path

```text
Contracts
  -> SQLite schema
  -> repositories
  -> pure decision engines
  -> POST /decisions
  -> persisted audit trail
  -> React transaction submission
  -> decision visualization
  -> factor adapter
  -> blocked-factor enforcement
  -> end-to-end smoke
  -> demo polish
  -> real WebAuthn only if everything above is stable
```

---

# Final implementation rule

Before adding a component, endpoint, table, provider, or dependency, ask:

> Does this make the service more convincingly deployable, more enforceable, or more impressive in the judged flow?

If it does not strengthen the API decision, persistence, factor enforcement, audit evidence, or demo reliability, do not build it.
