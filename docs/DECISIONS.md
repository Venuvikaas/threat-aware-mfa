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
