# Engineering Decision Log

Every material decision is recorded with the same four-line format. This log is
the authoritative record of scope choices for the hackathon build.

---

## Frontend-only application

Decision: Build the product as a frontend-only React + Vite + TypeScript application with no server component.

Reason: The entire demo runs from static fixtures through one pure decision function rendered locally, which makes the build deterministic, offline-capable, and impossible to break with infrastructure failure.

Rejected: Any Express, Next.js, or API-backed architecture.

Consequence: The product can only demonstrate policy selection over seeded inputs; it cannot ingest live signals or integrate with production identity systems.

---

## Deterministic rules, not trained AI

Decision: The decision engine is a pure deterministic function over explicit, versioned rules.

Reason: Deterministic rules are testable, explainable, and demo-safe; a trained model adds no credibility without a validated dataset and introduces non-determinism on the judged path.

Rejected: Any ML model, LLM explanation, or probabilistic classifier.

Consequence: The engine cannot generalize beyond the rules defined in the policy fixture, and unsupported evidence must return `insufficient_evidence`.

---

## Confidence bands, not probabilities

Decision: Threat support is expressed as ordered bands (`high_support`, `moderate_support`, `insufficient_evidence`) and never as decimal probabilities.

Reason: Bands avoid fake precision and the credibility questions that calibrated-looking decimals invite; the review explicitly warned that invented likelihoods damage trust.

Rejected: Normalized likelihood tables, threat scores, or any probability output.

Consequence: The UI cannot rank near-threshold nuance beyond the three bands.

---

## Assurance as an eligibility gate

Decision: Required assurance is a threshold; a factor is either above it (eligible) or below it (excluded). Preference order, not assurance, ranks the survivors.

Reason: This resolves the selection-objective contradiction flagged in review: "select the lowest-friction eligible factor" and "highest assurance wins" cannot both be true.

Rejected: Assurance-maximizing selection with friction as tie-breaker.

Consequence: Assurance cannot express partial credit across factors, which is acceptable for a single-factor-path demo.

---

## No real WebAuthn

Decision: Passkey is a simulated factor card and a policy outcome; no real WebAuthn ceremony is executed.

Reason: Browser origin, enrollment, and authenticator state introduce demo risk while proving a standard integration rather than the product's decision logic; review listed WebAuthn as the most likely live-failure point.

Rejected: Any WebAuthn library or credential ceremony.

Consequence: The demo proves factor *selection*, not authentication security. The outcome card discloses "authentication execution simulated".

---

## No database or backend

Decision: Scenario fixtures and the policy are committed static files; UI state lives in browser memory only.

Reason: No persistence is required for the demo, and refresh must restore the deterministic default view. A database adds failure modes without demo value.

Rejected: SQLite, any ORM, decision ledger, or persistent store.

Consequence: No audit history or multi-session state exists.

---

## Fair scalar baseline

Decision: The baseline is a pure function of aggregate risk and required assurance only; it receives no raw threat indicators and returns the same step-up requirement for both hero scenarios.

Reason: A baseline that "sees" the SIM-change signal and still sends SMS would be a strawman; review explicitly required a fair comparison where the threat-aware engine wins on precision, not baseline incompetence.

Rejected: A deliberately unsafe baseline that sends SMS under SIM-change evidence.

Consequence: The baseline cannot produce scenario-specific explanations, which is exactly the information loss the product demonstrates.

---

## Assisted recovery as an external policy outcome

Decision: When no executable factor survives, the outcome is "payment paused, continue through assisted recovery" — a policy label, not an implemented recovery flow.

Reason: A hard block reads as a dead end for a legitimate customer; assisted recovery is the defensible, clearly-labeled fallback and requires no implementation.

Rejected: Permanent account lockout or a "block" terminal state.

Consequence: The prototype does not implement or simulate the recovery journey itself.

---

## Scope cuts recorded at the end of the build (Phase 6)

No must-build item was cut: the full Phase 0-6 checklist completed and its exit
gates passed, including the clean-checkout smoke gate and the offline production
preview. Two implementation-time refinements were recorded for transparency:

1. **tsconfig simplification** — the composite project reference to
   `tsconfig.node.json` was removed because it disabled emit (TS6310); a single
   root tsconfig now type-checks src, tests, and vite.config.ts. This is
   configuration hygiene, not a scope change.
2. **Adjacent UI commits merged** — a few checklist boxes that land in the same
   file share one commit (e.g., threat compatibility + availability + assurance
   gates in `evaluateFactors.ts`). Commit history remains one-commit-per-logical-unit and every box maps to a real change.

The optional features (A: decision JSON export, B: customer outcome preview,
C: keyboard controls) were intentionally not started until all mandatory phase
gates passed; per EXECUTION.md Part 4 they are evaluated only after the
must-build path is green.

---

## Claim discipline audit (Phase 4)

Decision: Keep every UI formulation within the approved copy set and document the audit.

Reason: The judged path must not overclaim detection, calibration, compliance, or execution.

Rejected: Any claim that the prototype detects fraud, authenticates a real payment, or is production-ready.

Consequence: All evidence labels are explicitly "synthetic indicators", and the outcome card always reads "Authentication execution simulated".

Audit result: A regex scan of `src/` for prohibited claims (detect*, calibrat*, probability, production-ready, compliance, executes, universal) found no UI copy violations; the only matches were CSS `border-radius` values.

---

## UI verification approach (post-review note)

Decision: The "test(ui)" checklist boxes are satisfied by engine-level tests plus scripted browser verification (Chrome DevTools automation) of the toggle, fallback, reset, and responsive layout.

Reason: Components contain no decision logic — they render the `Decision` object — so DOM-level tests would duplicate engine coverage without adding proof of the product claim.

Rejected: Adding @testing-library/jsdom component tests for the demo path.

Consequence: Interactive behavior is verified by the automated browser smoke runs recorded in this log, not by a jsdom test suite.

---

## Optional features shipped (post-mandatory-path)

Decision: All three Part 4 optional features were implemented after the mandatory Phase 0-6 gates passed: decision JSON export (copy-to-clipboard, no download), simulated customer outcome preview (two approved messages only), and keyboard demo controls (1/2 toggle passkey, R reset).

Reason: Each reinforces the demo without adding a dependency or a failure mode; export reinforces the embeddable-policy idea, the preview clarifies the customer-visible outcome, and keyboard controls keep the presenter's hands near the keyboard.

Rejected: File-download export (distracts from the demo), any additional keyboard shortcuts beyond the three, and making the preview look like live authentication.

Consequence: The demo path still makes zero network requests; the export writes only the exact engine `Decision` object.

---

## Pivot to backend-first decision service

Decision: Replace the frontend-only simulator with a backend-first product prototype: a Node/TypeScript + Express API with SQLite persistence, pure risk/threat/policy engines running server-side, and a React client that submits transactions through the API and renders the returned decision, factor eligibility, and persisted audit timeline.

Reason: The judged thesis is an integration boundary — "signals enter through an API, policy is enforced on the server, factor challenges cannot bypass the decision, and every result is auditable" (docs/EXECUTION.md). A static frontend cannot demonstrate that claim; the execution framework was replaced accordingly. This entry supersedes the two earlier "frontend-only application" and "no database or backend" decisions, which remain in the log as history.

Rejected: Staying with the frontend-only simulator, and the lemma.work agent platform (Python/FastAPI + PostgreSQL + Redis + task queues — every infrastructure category the execution framework bans).

Consequence: The API owns decisions and state; the frontend never calculates risk, threat, or factor eligibility and never decides whether a factor is allowed.

---

## Synthetic signal boundary

Decision: All signal providers are deterministic mock adapters; every provider result carries explicit provenance (name, value, source, observedAt, `synthetic: true`) and is stored that way. The demo database holds only synthetic users, devices, and transactions. The required factor path is an explicit simulated passkey adapter; real WebAuthn is a stretch phase with kill criteria.

Reason: The product must demonstrate the provider *contract* — and the policy decision that follows from it — without pretending to detect real fraud or to connect to real telecom, bank, UPI, or Account Aggregator systems.

Rejected: Live carriers, UPI, Account Aggregator, IP-reputation, device-fingerprinting SDKs, real SMS delivery, and any claim that those integrations exist. Mock providers must never fabricate a safe signal on failure; failure yields an explicit unknown signal.

Consequence: Every stored signal is tagged synthetic with source and observed time; provider failure is explicit rather than silent; and the UI labels simulation visibly. No OTP, passkey private key, biometric data, or secret is ever stored.

---

## Express + better-sqlite3 over Fastify or Prisma

Decision: The API uses Express with Zod validation, and SQLite is accessed through better-sqlite3 with explicit SQL migrations tracked in `schema_migrations`.

Reason: The execution framework says to use Fastify only if already comfortable with it and Prisma only if its migration flow is already known; neither was true, so the conservative defaults win. Explicit SQL migrations keep the entire data layer visible and reviewable in one place, and better-sqlite3's synchronous API makes the atomic decision/challenge transactions straightforward to reason about.

Rejected: Fastify, Prisma, and any ORM or query builder — they add indirection without strengthening the demo.

Consequence: The repository owns plain SQL; schema changes are explicit migration files.

---

## npm workspaces monorepo

Decision: The repository is a single npm-workspaces repository (`apps/api`, `apps/web`, `packages/contracts`, `packages/decision-core`, `packages/demo-data`) with root scripts for dev, typecheck, test, build, check, db:migrate, and smoke.

Reason: One `npm install` boots every package; TypeScript path aliases and Vitest aliases keep source-level imports working in both apps; the frozen contracts are the single shared dependency.

Rejected: pnpm/yarn workspaces, Turborepo, Nx, and a separate deployable per service.

Consequence: All packages must share compatible TypeScript/Vitest configuration; there is no per-service versioning.

---

## Blocked-factor enforcement at the challenge boundary

Decision: A blocked or unavailable factor cannot create a challenge: `POST /api/v1/challenges` validates the requested factor against the persisted decision's allowed list and answers `POLICY_REJECTION` otherwise. Challenges are one-time (consumed atomically on verification), expire after 5 minutes, and reject replay.

Reason: The judged wow moment is a direct API proof — "request the blocked channel, get rejected, then execute the allowed factor" — which only works if policy is enforced server-side at the execution boundary, not just displayed.

Rejected: Client-side-only factor gating, and challenge-less direct authorization.

Consequence: A frontend that tries the blocked channel sees a real 409; the audit trail records the attempt.

---

## Fair scalar baseline as a server endpoint

Decision: The scalar baseline is a pure function of risk level exposed as `GET /api/v1/demo/baseline`; the client renders it as a shared result and never computes it.

Reason: The baseline exists only to show information loss (equal-risk transactions receive the same severity-only requirement). Serving it from the API keeps the frontend free of policy logic and makes the comparison reproducible in the demo.

Rejected: Computing the baseline in the browser, or adding it to the frozen decision response.

Consequence: The baseline is demo-scoped; it does not alter the decision contract.

---

## Simulated passkey adapter only (no real WebAuthn)

Decision: The demo ships the simulated passkey adapter with an explicit `SIMULATED` mode. Real WebAuthn remains the stretch phase with kill criteria from docs/EXECUTION.md Phase 7.

Reason: The adapter contract, challenge lifecycle, replay safety, and audit trail are the demonstration value; a real ceremony adds browser-origin risk to the judged flow without changing the decision story.

Rejected: Shipping a half-configured WebAuthn path that could break the presentation environment.

Consequence: The factor execution step is visibly labeled as simulated.

---

## Real WebAuthn with labeled automatic fallback (Phase 7)

Decision: Ship real WebAuthn (SimpleWebAuthn server + browser) for passkey registration and authentication, with the simulated adapter as an automatic, clearly labeled fallback. The PASSKEY factor adapter runs a real ceremony only when the user has a registered credential **and** the request origin is a WebAuthn-capable secure context (https or localhost); otherwise it returns the simulated adapter's `SIMULATED` mode, and the challenge response's `mode` field plus the UI make that choice explicit. This supersedes the earlier "Simulated passkey adapter only (no real WebAuthn)" entry.

Reason: The stretch phase's exit gate requires "registration and authentication work on the exact demo origin" and "the simulated adapter remains a clearly labeled fallback". Deriving the RP id and expected origin from the request `Origin` header (default `http://localhost:5173`) makes the ceremony bind to whatever host the demo is presented from; the fallback rule means a non-secure demo host, an unenrolled user, or a browser without WebAuthn degrades to the labeled simulated path instead of breaking the demo. Public credential data only (id, COSE public key, counter, transports) is persisted; verification enforces challenge, origin, RP id, and credential ownership and advances the counter against replay.

Rejected: Shipping WebAuthn that required changing the demo host, browser profile, or critical-path contracts; accepting `{ simulatedOk: true }` on a real WEBAUTHN challenge (that would let API readers bypass the ceremony); and deleting the simulated adapter. One additive, optional request field was added to the frozen contract: `preferSimulated` on `POST /api/v1/challenges`, a demo-only hint rejected outside demo mode that lets the UI offer the labeled fallback when a browser ceremony cannot complete.

Consequence: Registration and authentication are demo-gated (the only users are synthetic). If the ceremony is unstable in the exact presentation environment, the kill criteria still apply — nothing in the decision, persistence, or audit path depends on the browser ceremony.
