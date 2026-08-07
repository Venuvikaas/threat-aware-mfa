# Threat-Aware MFA Policy Simulator - Execution Framework & Mega Checklist

#### Solo developer · 12-hour build · one commit per completed box

This document converts the final PRD into a build sequence optimized for one developer, one machine, and one deterministic hackathon demo.

## How to read this

- **[DEV]** = implementation work.
- **[TEST]** = automated or manual verification.
- **[DEMO]** = work that directly improves the judged experience.
- **[DOCS]** = submission and decision documentation.
- **🔴 BLOCKING** = complete before dependent work starts.
- **🟡 OPTIONAL** = do only after the complete must-build path passes.
- **✂ KILL** = remove immediately if its stated condition occurs.
- **🔗 CONTRACT** = freeze the data shape before UI work.
- Tick a box only when its exit condition passes.
- Every completed box ends with the suggested small commit.

## Non-negotiable product boundary

Build a **frontend-only, deterministic policy simulator** that demonstrates:

> Same aggregate risk can require different authentication decisions because different channels or security properties may be under suspicion.

The product is not a fraud detector, identity provider, authentication platform, real payment system, or trained AI model.

## Final build target

The submission contains:

- One comparison workspace
- Two seeded hero scenarios
- One pure TypeScript decision engine
- One versioned static policy
- Three factor outcomes: SMS OTP, passkey, assisted recovery
- One fair scalar baseline
- One passkey-enrollment toggle
- One deterministic reset action
- Automated decision-kernel tests
- A polished 2 to 3 minute demo path

---

# PART 1 - Engineering framework

## 1. Contract-first development 🔗

Freeze the domain contract before creating visual components. The decision engine and UI must communicate through exact TypeScript types.

Required contracts:

```ts
type RiskLevel = "high";

type ThreatHypothesis =
  | "sim_channel_compromise"
  | "phishing"
  | "insufficient_evidence";

type SupportBand =
  | "high_support"
  | "moderate_support"
  | "insufficient_evidence";

type FactorId = "sms_otp" | "passkey";

type FactorState = "eligible" | "excluded" | "unavailable";

type DecisionOutcome =
  | "factor_selected"
  | "assisted_recovery";

interface Scenario {
  id: string;
  title: string;
  aggregateRisk: RiskLevel;
  requiredAssurance: number;
  transaction: {
    amount: number;
    currency: "INR";
    payeeType: "new" | "known";
  };
  indicators: {
    recentSimChange: boolean;
    phishingRelayIndicator: boolean;
    newDevice: boolean;
    unusualSession: boolean;
    newPayee: boolean;
  };
  capabilities: {
    passkeyEnrolled: boolean;
  };
}

interface FactorEvaluation {
  factorId: FactorId;
  state: FactorState;
  reasonCode: string;
  reason: string;
  assurance: number;
}

interface Decision {
  scenarioId: string;
  policyVersion: string;
  hypothesis: ThreatHypothesis;
  supportBand: SupportBand;
  evidenceUsed: string[];
  doNotTrust: string[];
  factors: FactorEvaluation[];
  selectedFactor: FactorId | null;
  outcome: DecisionOutcome;
  outcomeMessage: string;
}
```

Contract rules:

- No nullable or optional fields unless explicitly required.
- No decimal threat probabilities.
- No time, random, browser, storage, or network values in the decision function.
- Every factor receives exactly one state.
- Every non-eligible factor receives one stable reason code and one human-readable reason.
- Unsupported evidence returns `insufficient_evidence`; it must not produce a confident threat.

## 2. Pure-kernel-first development

Do not begin with the polished UI. The first complete artifact must be:

```ts
evaluateScenario(scenario, policy): Decision
```

The kernel is complete only when scenario tests prove:

- SIM-change evidence produces SIM-channel-compromise reasoning.
- Phishing-relay evidence produces phishing reasoning.
- Passkey availability changes the outcome without changing the threat hypothesis.
- No excluded or unavailable factor can be selected.
- Identical inputs return deeply equal outputs.

## 3. Vertical-slice development

Build one narrow end-to-end slice before adding the second scenario:

`SIM-swap fixture -> decision engine -> factor cards -> selected passkey -> toggle unavailable -> assisted recovery`

Only after this works should the phishing comparison be added.

## 4. Demo-data discipline

- All scenarios are curated fixtures committed to the repository.
- The UI must visibly display `Synthetic indicators`.
- No external requests are allowed on the demo path.
- Reset must restore the exact default state.
- The default view itself must communicate the idea without configuration.

## 5. Git workflow

- Use trunk-based development on `main`.
- Make one small commit per completed checklist box.
- Pull before starting a new phase if working across machines.
- Push after each stable phase.
- Never commit generated secrets, `.env`, editor caches, or build artifacts.

Commit scopes:

- `engine` - classifier and policy evaluator
- `policy` - factor matrix and policy fixture
- `scenario` - demo fixtures
- `ui` - visual components and interaction
- `test` - unit and scenario tests
- `style` - presentation polish
- `docs` - README, decisions, execution, demo script
- `chore` - project configuration

## 6. Decision log

Create `docs/DECISIONS.md`. Every material change uses four lines:

```md
## Decision title
Decision: What was chosen.
Reason: Why it increases build reliability or demo impact.
Rejected: What was not chosen.
Consequence: What limitation is accepted.
```

Required initial decisions:

- Frontend-only application
- Deterministic rules, not trained AI
- Confidence bands, not probabilities
- Assurance as an eligibility gate
- No real WebAuthn
- No database or backend
- Fair scalar baseline
- Assisted recovery as an external policy outcome

## 7. Smoke gate

A single command must verify the product before every demo run:

```bash
npm run check
```

It should run:

1. TypeScript validation
2. Unit and scenario tests
3. Production build

The command must exit non-zero on any failure.

## 8. Kill criteria

Apply these immediately. Do not negotiate with sunk cost.

- ✂ If any feature needs a backend, cut the feature.
- ✂ If any feature needs browser permissions, cut the feature.
- ✂ If real passkey execution is proposed, retain only the simulated selected-factor card.
- ✂ If a visual requires a charting library, replace it with cards, chips, or a list.
- ✂ If an explanation needs an LLM, replace it with a fixed reason code and deterministic copy.
- ✂ If a third threat scenario is proposed, cut it.
- ✂ If a policy editor is proposed, keep the policy as a committed fixture.
- ✂ If a rule cannot be defended in one sentence, narrow or remove it.
- ✂ If the core comparison is not stable, remove every nice-to-have.

## 9. Visual system

Use one consistent visual grammar:

- **Blue or neutral:** observed evidence
- **Amber:** suspected threat or caution
- **Red:** excluded factor or untrusted dependency
- **Green:** eligible or selected factor
- **Gray:** unavailable factor
- **Purple or dark neutral:** assisted recovery outcome

Do not use color as the only signal. Every state includes a label and icon or shape change.

## 10. Claim discipline

The UI and presentation must never claim:

- the app detected a SIM swap or phishing attack,
- the support bands are calibrated probabilities,
- passkeys defeat every device-compromise scenario,
- the product proves universal factor independence,
- the app executes or secures a real payment,
- the product is compliant or production-ready,
- existing identity platforms cannot express similar rules.

Use these approved formulations:

- `The scenario supplies synthetic indicators.`
- `The engine applies a deterministic demonstration policy.`
- `The policy marks SMS OTP incompatible with this suspected failure path.`
- `The prototype selects a policy outcome; it does not execute authentication.`

---

# PART 2 - Repository layout

```text
threat-aware-mfa/
  src/
    engine/
      evaluateScenario.ts
      classifyThreat.ts
      evaluateFactors.ts
      selectOutcome.ts
      types.ts
    policy/
      demoPolicy.ts
      reasonCodes.ts
    scenarios/
      simSwap.ts
      phishing.ts
    components/
      AppShell.tsx
      ComparisonWorkspace.tsx
      ScenarioPanel.tsx
      SharedRiskHeader.tsx
      EvidenceList.tsx
      ThreatSummary.tsx
      FactorCard.tsx
      DecisionTrace.tsx
      BaselineCard.tsx
      CapabilityToggle.tsx
      OutcomeCard.tsx
    styles/
      tokens.css
      app.css
    App.tsx
    main.tsx
  tests/
    classifyThreat.test.ts
    evaluateFactors.test.ts
    scenarios.test.ts
    determinism.test.ts
  docs/
    PRD.md
    EXECUTION.md
    DECISIONS.md
    demo-script.md
  public/
  .gitignore
  README.md
  package.json
  tsconfig.json
  vite.config.ts
```

Rules:

- `engine/` has no React imports.
- `policy/` contains rules and copy-safe reason metadata, not components.
- `scenarios/` contains seeded input only, not expected UI output.
- Components render the `Decision` object; they do not duplicate decision logic.
- Tests import the same fixtures and policy used by the app.

---

# PART 3 - Mega checklist

## ☑ PHASE 0 - Freeze scope and contracts 🔴 BLOCKING

- [x] **[DOCS]** Place the final PRD at `docs/PRD.md`.  
  Commit: `docs: add final product requirements`

- [x] **[DOCS]** Add this file as `docs/EXECUTION.md`.  
  Commit: `docs: add execution framework`

- [x] **[DOCS]** Create `docs/DECISIONS.md` with the eight required initial decisions.  
  Commit: `docs: record final scope decisions`

- [x] **[DEV]** Initialize a React, Vite, and TypeScript application with no backend template.  
  Commit: `chore: initialize client application`

- [x] **[DEV]** Add `.gitignore` for `.env`, `node_modules`, build output, coverage, editor files, and OS files.  
  Commit: `chore: add repository hygiene`

- [x] **[DEV]** Create the repository folders shown above.  
  Commit: `chore: scaffold project structure`

- [x] **[DEV]** 🔗 Freeze all domain types in `src/engine/types.ts`.  
  Commit: `feat(engine): freeze decision contracts`

- [x] **[TEST]** Confirm the project installs, type-checks, and renders the untouched app shell.  
  Commit: `test: verify project bootstrap`

### Exit gate

- [x] `npm run dev` renders locally.
- [x] `npm run build` succeeds.
- [x] Contracts are committed before decision logic or UI components.
- [x] The repository contains no backend, database, auth, LLM, or chart dependency.

---

## ☑ PHASE 1 - Build the policy kernel 🔴 BLOCKING

### Threat classification

- [x] **[DEV]** Define reason-code constants and approved explanation copy.  
  Required examples:
  - `RECENT_SIM_CHANGE`
  - `PHISHING_RELAY_SIGNAL`
  - `SMS_CHANNEL_UNTRUSTED`
  - `FACTOR_RELAYABLE`
  - `PASSKEY_NOT_ENROLLED`
  - `ASSURANCE_TOO_LOW`
  - `INSUFFICIENT_EVIDENCE`
  
  Commit: `feat(policy): define stable reason codes`

- [x] **[DEV]** Define `demoPolicy.ts` with a visible policy version.  
  Commit: `feat(policy): add versioned demo policy`

- [x] **[DEV]** Implement `classifyThreat()` with explicit precedence and no probability values.  
  Decision rules:
  - Recent SIM change with supporting context -> `sim_channel_compromise`
  - Phishing-relay indicator -> `phishing`
  - No supported primary indicator -> `insufficient_evidence`
  - If both primary indicators are present, return `insufficient_evidence` for the MVP rather than inventing conflict resolution
  
  Commit: `feat(engine): classify supported threats`

- [x] **[TEST]** Test each supported hypothesis, insufficient evidence, and conflicting primary indicators.  
  Commit: `test(engine): cover threat classification`

### Factor evaluation

- [x] **[DEV]** Define SMS OTP and passkey factor metadata.  
  Commit: `feat(policy): define factor registry`

- [x] **[DEV]** Implement threat-compatibility evaluation.  
  Commit: `feat(engine): evaluate threat compatibility`

- [x] **[DEV]** Implement capability evaluation for passkey enrollment.  
  Commit: `feat(engine): evaluate factor availability`

- [x] **[DEV]** Implement assurance-threshold evaluation.  
  Commit: `feat(engine): enforce assurance gate`

- [x] **[DEV]** Ensure every factor receives exactly one final state and one reason object.  
  State precedence:
  1. `excluded` when threat-incompatible
  2. `unavailable` when not user-completable
  3. `excluded` when assurance is below threshold
  4. `eligible` otherwise
  
  Commit: `feat(engine): finalize factor evaluation states`

- [x] **[TEST]** Prove no threat-incompatible, unavailable, or below-assurance factor can be selected.  
  Commit: `test(engine): enforce factor-selection invariants`

### Outcome selection

- [x] **[DEV]** Implement fixed preference selection among eligible factors.  
  Commit: `feat(engine): select eligible factor`

- [x] **[DEV]** Implement assisted-recovery fallback when no factor survives.  
  Commit: `feat(engine): add assisted recovery outcome`

- [x] **[DEV]** Compose the complete `evaluateScenario()` pure function.  
  Commit: `feat(engine): compose policy decision kernel`

- [x] **[TEST]** Test deep equality for repeated calls using identical input.  
  Commit: `test(engine): verify deterministic output`

### Exit gate

- [x] The kernel accepts a scenario and policy and returns a complete decision.
- [x] The kernel has no React, storage, network, clock, random, or browser dependency.
- [x] All kernel tests pass.
- [x] No output contains a decimal probability.
- [x] Conflicting or unsupported evidence produces `insufficient_evidence`.

---

## ☑ PHASE 2 - Complete the first vertical slice 🔴 BLOCKING

### SIM-swap scenario

- [x] **[DEV]** Create the default SIM-swap fixture with synthetic indicators.  
  Commit: `feat(scenario): add sim swap fixture`

- [x] **[TEST]** Assert the SIM-swap fixture produces:
  - same documented high risk,
  - `sim_channel_compromise`,
  - `high_support` or the policy's explicit support band,
  - SMS OTP excluded,
  - passkey eligible when enrolled,
  - passkey selected.
  
  Commit: `test(scenario): lock sim swap outcome`

### Minimum user interface

- [x] **[DEV]** Build `AppShell` with product name, one-line value proposition, and synthetic-data disclosure.  
  Commit: `feat(ui): add application shell`

- [x] **[DEV]** Build a single `ScenarioPanel` using the SIM-swap output.  
  Commit: `feat(ui): render scenario panel`

- [x] **[DEV]** Build evidence chips from `Decision.evidenceUsed`.  
  Commit: `feat(ui): render observed evidence`

- [x] **[DEV]** Build the threat summary with hypothesis, support band, and `Do not trust` property.  
  Commit: `feat(ui): render threat summary`

- [x] **[DEV]** Build factor cards for SMS OTP and passkey.  
  Commit: `feat(ui): render factor states`

- [x] **[DEV]** Build the selected-factor outcome card.  
  Commit: `feat(ui): render decision outcome`

- [x] **[DEV]** Add passkey-enrollment toggle. The toggle changes scenario input only.  
  Commit: `feat(ui): toggle passkey capability`

- [x] **[TEST]** Toggle passkey off and verify:
  - threat hypothesis does not change,
  - passkey becomes unavailable,
  - SMS remains excluded,
  - assisted recovery becomes the outcome.
  
  Commit: `test(ui): verify capability fallback flow`

- [x] **[DEV]** Add deterministic reset to the default enrolled state.  
  Commit: `feat(ui): add demo reset`

### Exit gate

- [x] One complete end-to-end scenario works from fixture to visible outcome.
- [x] The passkey toggle proves that availability does not override threat compatibility.
- [x] Reset always restores the same state.
- [x] No decision rule exists inside a React component.

---

## ☑ PHASE 3 - Build the hero comparison 🔴 BLOCKING

### Phishing scenario

- [x] **[DEV]** Create the phishing-relay fixture with the same aggregate risk, required assurance, transaction amount, and payee sensitivity as the SIM-swap fixture.  
  Commit: `feat(scenario): add phishing fixture`

- [x] **[TEST]** Assert the phishing fixture produces:
  - `phishing`,
  - phishing-specific evidence,
  - SMS OTP excluded with a phishing-specific reason,
  - passkey selected when enrolled.
  
  Commit: `test(scenario): lock phishing outcome`

### Comparison workspace

- [x] **[DEV]** Build `SharedRiskHeader` to make the shared risk and assurance requirement visually explicit.  
  Commit: `feat(ui): show shared scalar risk`

- [x] **[DEV]** Build the two-column `ComparisonWorkspace`.  
  Commit: `feat(ui): add side by side comparison`

- [x] **[DEV]** Highlight only the evidence and exclusion rationale that differs between panels.  
  Commit: `feat(ui): emphasize threat difference`

- [x] **[DEV]** Add a compact five-stage trace to each panel:
  1. Observed
  2. Suspected
  3. Do not trust
  4. Excluded
  5. Decision
  
  Commit: `feat(ui): add five stage decision trace`

- [x] **[TEST]** Verify both scenarios show equal aggregate risk and distinct hypothesis-specific reasons.  
  Commit: `test(ui): verify same risk comparison`

### Fair scalar baseline

- [x] **[DEV]** Implement a pure scalar baseline that accepts only risk and required assurance.  
  Output for both scenarios: `phishing-resistant factor required`.
  
  Commit: `feat(engine): add fair scalar baseline`

- [x] **[TEST]** Prove the baseline receives no threat indicators.  
  Commit: `test(engine): constrain baseline inputs`

- [x] **[DEV]** Render the baseline as a compact shared card, not as a competing full panel.  
  Commit: `feat(ui): render scalar baseline`

### Exit gate

- [x] Default launch shows the full hero comparison.
- [x] Same risk is visually obvious.
- [x] Different evidence and exclusion reasons are visually obvious.
- [x] The baseline is fair and does not intentionally select an unsafe method.
- [x] A viewer can understand the core contrast without opening another screen.

---

## ☑ PHASE 4 - Harden the judged path 🔴 BLOCKING

### Product integrity

- [x] **[DOCS]** Search UI copy for prohibited claims from Part 1.  
  Commit: `docs: enforce prototype claim discipline`

- [x] **[DEV]** Add visible labels:
  - `Synthetic indicators`
  - `Deterministic demonstration policy`
  - policy version
  - `Authentication execution simulated` on the outcome card
  
  Commit: `feat(ui): disclose simulation boundaries`

- [x] **[TEST]** Verify no unsupported evidence creates a confident decision.  
  Commit: `test: verify conservative unknown handling`

### UI resilience

- [x] **[DEV]** Add safe rendering for empty evidence, unknown reason code, and missing factor metadata.  
  Commit: `fix(ui): add defensive decision rendering`

- [x] **[DEV]** Ensure factor state is never communicated through color alone.  
  Commit: `fix(ui): add accessible state labels`

- [x] **[DEV]** Ensure the two-column layout becomes a readable single column on narrow screens.  
  Commit: `style(ui): add responsive comparison layout`

- [x] **[DEV]** Prevent long reason text from overflowing cards.  
  Commit: `fix(ui): contain decision trace content`

### Automated gate

- [x] **[DEV]** Configure `npm run check` to run type-check, tests, and production build.  
  Commit: `chore: add full project check`

- [x] **[TEST]** Run `npm run check` from a clean checkout state.  
  Commit: `test: pass full project check`

- [x] **[TEST]** Verify the built application runs without a network connection.  
  Commit: `test: verify offline demo path`

### Manual smoke sequence

- [x] Launch the app.
- [x] Confirm both scenarios load with identical scalar risk.
- [x] Confirm the hypotheses differ.
- [x] Confirm SMS has a different exclusion reason in each panel.
- [x] Confirm passkey is selected by default.
- [x] Toggle passkey off on the SIM-swap panel.
- [x] Confirm the hypothesis remains SIM-channel compromise.
- [x] Confirm assisted recovery becomes the outcome.
- [x] Reset.
- [x] Confirm all default values return.
- [x] Refresh.
- [x] Confirm the deterministic default view returns.

### Exit gate

- [x] `npm run check` passes.
- [x] Manual smoke sequence passes without browser prompts or network calls.
- [x] No prohibited claim appears in the UI.
- [x] The entire judged path works using preset controls only.

---

## ☑ PHASE 5 - Demo polish 🔴 BLOCKING

### Visual hierarchy

- [x] **[DEMO]** Make `SAME RISK` the first visual anchor.  
  Commit: `style(ui): emphasize shared risk`

- [x] **[DEMO]** Make each differing threat indicator the second visual anchor.  
  Commit: `style(ui): emphasize threat evidence`

- [x] **[DEMO]** Make each excluded factor and reason the third visual anchor.  
  Commit: `style(ui): emphasize factor exclusion`

- [x] **[DEMO]** Make the final selected factor or assisted recovery outcome the strongest result state.  
  Commit: `style(ui): emphasize policy outcome`

- [x] **[DEMO]** Remove decorative elements that do not support the five-stage trace.  
  Commit: `style(ui): remove nonessential decoration`

### Interaction polish

- [x] **[DEV]** Add small CSS transitions for state changes only. No animation library.  
  Commit: `style(ui): add restrained state transitions`

- [x] **[DEV]** Keep all primary controls visible without a menu.  
  Commit: `fix(ui): keep demo controls visible`

- [x] **[DEMO]** Verify all text is readable at presentation zoom and screen-recording resolution.  
  Commit: `style(ui): tune presentation readability`

### Exit gate

- [x] The default screen is presentation-ready.
- [x] A screenshot communicates the core idea.
- [x] The wow-moment toggle is visible and reliable.
- [x] Polish has not introduced a new dependency or failure mode.

---

## ☑ PHASE 6 - Documentation and submission readiness 🔴 BLOCKING

### README

- [x] **[DOCS]** Write `README.md` with:
  - product statement,
  - problem,
  - what the simulator demonstrates,
  - explicit non-goals,
  - prerequisites,
  - install and run commands,
  - test command,
  - demo scenarios,
  - architecture summary,
  - claim limitations.
  
  Commit: `docs: add project readme`

- [x] **[DOCS]** Ensure clone-to-run instructions fit in fewer than ten commands.  
  Commit: `docs: simplify local runbook`

### Demo script

- [x] **[DOCS]** Write `docs/demo-script.md` using this sequence:
  1. Ask whether equal risk should mean equal authentication.
  2. Point to the shared high-risk score.
  3. Reveal SIM-change evidence versus phishing-relay evidence.
  4. Show the scalar baseline returns the same assurance requirement.
  5. Follow both five-stage traces.
  6. Explain why SMS is excluded for different reasons.
  7. Toggle passkey enrollment off.
  8. Show that the engine chooses assisted recovery instead of unsafe fallback.
  9. Close with the tagline and product boundary.
  
  Commit: `docs: add final demo script`

- [x] **[DEMO]** Ensure every statement in the script is visible in the product or explicitly framed as a product-boundary explanation.  
  Commit: `docs: align demo claims with product`

### Submission evidence

- [x] **[DOCS]** Add final screenshots or recording link placeholders to the README.  
  Commit: `docs: add demo evidence section`

- [x] **[DOCS]** Complete `DECISIONS.md` with all scope cuts made during implementation.  
  Commit: `docs: finalize engineering decisions`

- [x] **[TEST]** Scan tracked files and Git history for secrets or accidental `.env` content.  
  Commit: `chore: complete secrets review`

### Exit gate

- [x] A new reviewer can understand the product boundary from the README.
- [x] The demo script matches the shipped UI exactly.
- [x] All major cuts have a recorded reason.
- [x] No secrets or external credentials are required.

---

# PART 4 - Optional features

Do not begin this section until every Phase 0 to Phase 6 exit gate passes.

## ☐ OPTIONAL A - Export decision JSON 🟡 OPTIONAL

- [x] **[DEV]** Add a copy or download action for the current `Decision` object.  
  Commit: `feat(ui): export decision json`

- [x] **[TEST]** Verify export exactly matches the engine output and contains no UI-only fields.  
  Commit: `test(ui): verify decision export`

- ✂ KILL if browser download behavior distracts from the primary demo.

## ☐ OPTIONAL B - Customer outcome preview 🟡 OPTIONAL

- [x] **[DEV]** Add a compact preview labeled `Simulated customer message`.  
  Commit: `feat(ui): add simulated customer outcome`

- [x] **[TEST]** Ensure it displays only:
  - `Use your passkey to authorize this payment`, or
  - `Payment paused. Continue through assisted recovery.`
  
  Commit: `test(ui): verify customer outcome copy`

- ✂ KILL if it looks like authentication is actually being executed.

## ☐ OPTIONAL C - Keyboard demo controls 🟡 OPTIONAL

- [x] **[DEV]** Add shortcuts for reset and passkey toggle only if discoverability remains clear.  
  Commit: `feat(ui): add demo keyboard controls`

- ✂ KILL if shortcuts create accidental state changes during recording.

---

# PART 5 - Final definition of done

The project is submitted only when every item below is true.

## Product

- [x] One screen presents the complete core comparison.
- [x] Two scenarios share the same aggregate risk and required assurance.
- [x] The scenarios derive different supported threat hypotheses.
- [x] SMS OTP is excluded with a scenario-specific reason in both cases.
- [x] Passkey is selected only when compatible, enrolled, and above the assurance threshold.
- [x] Removing passkey enrollment produces assisted recovery, not unsafe fallback.
- [x] Unsupported or conflicting evidence produces insufficient evidence.

## Engineering

- [x] The decision engine is pure and deterministic.
- [x] UI components contain no duplicated policy logic.
- [x] Policy and scenarios are committed fixtures.
- [x] Every factor has exactly one state and one reason object.
- [x] Tests cover hero scenarios, fallback, unknown evidence, invariant enforcement, and determinism.
- [x] `npm run check` passes.
- [x] Production build works offline.

## Demo

- [x] The core contrast is visible without navigation.
- [x] Synthetic inputs and simulated execution are disclosed.
- [x] The scalar baseline is fair.
- [x] The passkey toggle produces the wow moment reliably.
- [x] Reset returns the exact default state.
- [x] No authentication prompt, permission prompt, login, loading wait, or network request appears.
- [x] The 2 to 3 minute script matches the shipped product.

## Integrity

- [x] No fake probabilities are shown.
- [x] No AI, fraud-detection, compliance, authentication-execution, or production-readiness overclaim appears.
- [x] No secrets exist in tracked files or Git history.
- [x] The README clearly states what the prototype does not do.

## Submission package

- [x] `docs/PRD.md`
- [x] `docs/EXECUTION.md`
- [x] `docs/DECISIONS.md`
- [x] `docs/demo-script.md`
- [x] `README.md`
- [x] Tested production build
- [x] Demo recording or live-demo-ready local build

---

# PART 6 - Critical-path cheat sheet

```text
Contracts
  -> Policy kernel
  -> Kernel tests
  -> SIM-swap vertical slice
  -> Passkey-unavailable fallback
  -> Phishing comparison
  -> Fair scalar baseline
  -> Five-stage traces
  -> Full project check
  -> Visual polish
  -> README and demo script
  -> Final smoke and submission
```

If the build slips, cut in this order:

1. Keyboard controls
2. Customer outcome preview
3. Decision JSON export
4. CSS transitions
5. Any decorative content outside the five-stage trace

Never cut:

- Pure decision engine
- Two same-risk scenarios
- Scenario-specific factor exclusion
- Capability toggle and assisted-recovery fallback
- Fair scalar baseline
- Deterministic tests
- Synthetic-data disclosure
- Claim discipline

---

# Final implementation rule

Before adding anything, ask:

> Does this make the evidence-to-exclusion decision clearer, safer, or more reliable in the demo?

If not, do not build it.
