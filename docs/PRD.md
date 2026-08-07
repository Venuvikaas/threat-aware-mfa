# Threat-Aware MFA Policy Simulator

## Final Product Requirements Document

**Build constraint:** One developer, 12 hours  
**Product type:** Demo-ready policy decision simulator  
**Primary user:** Payment authentication policy designer  
**Final scope decision:** Frontend-only, deterministic, two-scenario comparison with no live authentication or external integrations

---

## 1. Executive Summary

### Product overview

Threat-Aware MFA Policy Simulator is an interactive decision tool that shows how the suspected compromise path of a payment should influence which authentication factors remain safe to use.

The product accepts a small set of seeded transaction and threat indicators, derives a transparent ranked threat hypothesis, removes authentication factors that depend on the suspected compromised channel, and returns the lowest-friction eligible factor with a deterministic reason trace.

The hackathon product is deliberately a **policy simulator**, not a fraud detector, identity provider, authentication platform, or production payment system. It demonstrates one focused claim: two payments with the same aggregate risk can require different authentication decisions because different channels may be compromised.

### One-sentence value proposition

**Risk tells you how worried to be; threat context tells you what not to trust.**

### Why this product deserves to exist

Conventional risk scores compress different attack conditions into one severity value. That value can determine whether to step up authentication, but it does not by itself identify which factor may be unsafe. This product preserves the attack context through the authentication decision and makes the resulting exclusion logic visible, testable, and explainable.

---

## 2. Problem Statement

### Core problem

A payment can be correctly classified as high risk while still receiving an inappropriate authentication challenge. If the risk is driven by a recent SIM change, sending an SMS OTP routes the challenge through the channel under suspicion. A scalar score describes severity but loses the reason behind that severity.

### Target user

The primary user is a **payment authentication policy designer or fraud decision engineer** who needs to answer:

- Which authentication factors remain trustworthy for this event?
- Why was a factor excluded?
- Does the selected factor meet the configured assurance requirement?
- How would the decision change if the threat evidence changed?

The end customer is represented only through a compact payment outcome preview. The MVP does not attempt to provide a complete customer authentication journey.

### Why existing solutions are insufficient for this demonstration

Adaptive authentication and authentication-strength policies can already step up, restrict, or require configured methods. The gap demonstrated here is narrower: aggregate risk alone does not preserve the suspected failure path as a first-class input to factor selection.

The product does not claim that existing platforms cannot encode equivalent rules. It demonstrates a clearer policy abstraction and inspection experience:

`evidence -> threat hypothesis -> compromised dependency -> excluded factor -> selected survivor`

### Why this solution is meaningfully different

The differentiator is not a new authentication factor or an AI model. It is the explicit connection between:

1. the evidence driving the risk,
2. the channel or security property placed under suspicion,
3. the factors made ineligible by that suspicion, and
4. a human-readable decision trace.

The product wins on clarity and policy precision, not infrastructure breadth.

---

## 3. Product Vision

The user opens one polished comparison screen containing two payment events with the **same aggregate risk score**.

The user sees that the events differ by one primary threat indicator. The first event contains a recent SIM change. The second contains a phishing-relay indicator. Each panel immediately shows:

- the observed evidence,
- the top threat hypothesis and confidence band,
- the dependency placed under suspicion,
- the factor that was removed,
- the selected eligible factor or assisted-recovery outcome, and
- a short reason trace.

The user can switch the threat evidence or load a preset scenario. The decision updates instantly and deterministically.

The memorable moment is not a chart or authentication ceremony. It is the visible divergence: **same risk, different threat, different safe factor**.

The experience should feel like inspecting a security decision, not operating a generic admin dashboard. It should be compact, visual, and understandable without a long explanation.

---

## 4. Scope

### Must Build

#### 4.1 One comparison workspace

A single responsive screen with two side-by-side decision panels. Both display the same aggregate risk and transaction sensitivity, while their threat evidence differs.

**Reason:** This is the fastest and clearest way to prove the product's core claim.

#### 4.2 Two deterministic hero scenarios

**Scenario A: Suspected SIM swap**

- Aggregate risk: High
- Evidence: recent SIM change, new device, new payee
- Top hypothesis: SIM channel compromise
- SMS OTP: excluded
- Passkey: eligible if enrolled
- Outcome: passkey selected

**Scenario B: Suspected phishing relay**

- Aggregate risk: High
- Evidence: phishing-relay indicator, new payee, unusual session
- Top hypothesis: phishing
- SMS OTP: excluded because it is relayable
- Passkey: eligible because the policy defines it as origin-bound
- Outcome: passkey selected

The panels should emphasize that the **reason for exclusion differs**, even when the surviving factor is the same. A quick toggle may replace passkey enrollment with `false` to produce assisted recovery and demonstrate capability filtering.

**Reason:** Two scenarios are enough to show composition-aware decisions without introducing unsafe claims about device independence.

#### 4.3 Transparent hypothesis classification

The engine uses deterministic rules to produce:

- one ranked threat hypothesis,
- one confidence band: `high support`, `moderate support`, or `insufficient evidence`, and
- the exact evidence that caused the classification.

It must not output probability decimals or claim statistical calibration.

**Reason:** Confidence bands avoid fake precision while retaining an interpretable inference step.

#### 4.4 Three factor definitions

- **SMS OTP**
- **Passkey**
- **Assisted recovery** as a policy outcome, not an implemented authentication factor

Each executable factor definition contains only:

- identifier,
- display name,
- minimum assurance level,
- availability requirements,
- relevant failure properties,
- fixed preference rank.

**Reason:** Three outcomes are sufficient to demonstrate exclusion, selection, and safe fallback.

#### 4.5 Deterministic policy evaluator

The evaluator must:

1. classify the threat hypothesis from indicators,
2. identify the suspected compromised property or channel,
3. exclude incompatible factors,
4. exclude factors the user cannot complete,
5. retain factors that meet required assurance,
6. select the lowest-friction eligible factor using a fixed preference order, and
7. return assisted recovery if no executable factor survives.

**Reason:** This resolves the earlier contradiction. Assurance is a threshold, not the primary ranking objective.

#### 4.6 Decision trace

Every decision displays exactly five stages:

1. **Observed:** the indicators supplied to the engine.
2. **Suspected:** the ranked threat hypothesis.
3. **Do not trust:** the affected channel or property.
4. **Excluded:** each removed factor and one reason code.
5. **Decision:** selected factor or assisted recovery.

**Reason:** The trace is the product's main evidence and its strongest judge-facing visual.

#### 4.7 Fair scalar baseline

A compact baseline result shows what a severity-only policy can determine when it receives only:

- aggregate risk level, and
- required assurance.

For both high-risk scenarios, it returns the same predefined step-up requirement: `phishing-resistant factor required`.

The baseline does not receive raw threat indicators and is not portrayed as incompetent. The threat-aware engine adds value by explaining which factors are incompatible and whether a usable factor survives.

**Reason:** This makes the comparison fair and avoids a strawman SMS baseline.

#### 4.8 Deterministic demo controls

- Load SIM-swap scenario
- Load phishing scenario
- Toggle passkey enrollment
- Reset

**Reason:** These controls let the presenter show both threat filtering and user capability filtering without introducing more personas.

### Nice to Have

Only add these if every must-build acceptance criterion already passes:

#### 4.9 Simulated customer outcome card

A compact, clearly labeled preview showing either:

- `Use your passkey to authorize this payment`, or
- `Payment paused. Continue through assisted recovery.`

No authentication is executed.

#### 4.10 Export decision JSON

Copy or download the current decision object.

**Reason:** It reinforces that the product could act as an embeddable policy component without requiring a backend or integration.

#### 4.11 Subtle state transitions

Small opacity or color transitions when a factor changes state. No complex animation library.

### Explicitly Out of Scope

#### Real WebAuthn or passkey execution

Removed because browser, origin, enrollment, and authenticator state introduce demo risk while proving a standard integration rather than the product's decision logic.

#### TOTP, PIN, biometrics, push approval, or second-device execution

Removed because authentication implementation does not strengthen the policy-selection claim and creates security, storage, and testing work.

#### External threat-signal APIs

Carrier SIM-swap, endpoint security, geolocation, and bank integrations are removed. All indicators are visibly labeled as seeded demo inputs.

#### Trained AI or calibrated fraud probabilities

Removed because no validated dataset is available. The product uses transparent scenario rules and must not imply model calibration.

#### General factor-combination or independence engine

Removed because factor independence is contextual and cannot be credibly reduced to a generic tag intersection within the build constraint.

#### Transaction signing or transaction binding

Removed because correct implementation requires challenge state and precise cryptographic claims. The simulator evaluates policy only.

#### Decision ledger, database, accounts, and authentication

Removed because the demo requires no persistent user state. The current decision can exist in browser memory and fixture files.

#### Policy editor or admin console

Removed because editable policy creates validation and conflict-resolution requirements. The MVP uses one visible, version-labeled policy fixture.

#### Multiple personas

Removed because the judge needs one memorable workflow. Capability variation is shown through one passkey-enrollment toggle.

#### Counterfactual generation for every factor

Removed because it adds text without improving the core decision. The interface may show one concise statement for the selected exclusion only.

#### Charts, radar plots, invented completion times, and extensive animation

Removed because they imply unsupported precision or consume effort without strengthening the proof.

#### Regulatory compliance claims

Removed from the product UI. The prototype demonstrates a policy idea and does not claim certification or compliance.

#### Real payments, recovery, fraud detection, account takeover prevention, or production deployment

The simulator makes decisions over synthetic scenarios. It does not detect attacks, move money, recover accounts, or secure a production system.

---

## 5. User Flow

1. **Launch**
   - The comparison workspace opens with the SIM-swap and phishing scenarios already loaded.
   - A banner states: `Synthetic indicators. Deterministic demonstration policy.`

2. **Understand the constant**
   - Both panels show the same transaction sensitivity, required assurance, and aggregate risk level.
   - The UI visually links these shared values.

3. **Inspect different evidence**
   - The user sees the evidence chips that differ between the panels.
   - Each panel highlights its top hypothesis and the supporting indicator.

4. **Follow factor elimination**
   - Factor cards move through three visible states: `eligible`, `excluded`, or `unavailable`.
   - Each non-eligible factor displays one plain-language reason and one stable reason code.

5. **See the decision**
   - The eligible factor with the best fixed preference rank is selected.
   - If none survives, the outcome is `pause payment and refer to assisted recovery`.

6. **Test capability filtering**
   - The user turns off passkey enrollment.
   - The passkey changes from `eligible` to `unavailable`.
   - The final outcome changes to assisted recovery while the threat decision remains unchanged.

7. **Reset**
   - One action restores all scenarios to their known demo state.

---

## 6. High-Level Architecture

### 6.1 Major components

#### React presentation layer

Renders the scenario controls, comparison panels, factor states, decision trace, and fallback outcome.

**Why it exists:** The project's value is primarily visual and interactive. React supports a clean component model and immediate state updates.

#### Scenario fixtures

Two static TypeScript or JSON objects define the transaction context, aggregate risk, indicators, user capabilities, and factor enrollment.

**Why they exist:** Fixtures make the demo repeatable, offline, and honest about signal provenance.

#### Pure TypeScript decision engine

A side-effect-free function accepts one scenario object and one versioned policy object, then returns one decision object.

Conceptual contract:

`Scenario + Policy -> Decision`

The decision contains:

- threat hypothesis,
- support band,
- evidence used,
- suspected compromised property,
- factor evaluations,
- selected factor or fallback outcome,
- reason codes,
- policy version.

**Why it exists:** It isolates the only technically differentiated logic and makes deterministic testing straightforward.

#### Static policy fixture

Defines:

- evidence-to-hypothesis rules,
- hypothesis-to-factor incompatibilities,
- assurance threshold,
- factor availability requirements,
- fixed factor preference order,
- assisted-recovery fallback.

**Why it exists:** The policy must be inspectable, reproducible, and separate from presentation code without requiring a policy editor.

### 6.2 Data flow

1. User loads or modifies a scenario.
2. UI sends the scenario and static policy to the decision engine in memory.
3. The engine classifies the top threat hypothesis.
4. The engine evaluates each factor against threat compatibility, capability, and assurance.
5. The engine selects the first eligible factor in the fixed preference order.
6. The engine returns a complete reason trace.
7. React renders the decision with no network call.

### 6.3 AI responsibilities

None.

The product uses transparent deterministic classification and policy evaluation. Calling this AI would weaken credibility. The intelligent behavior is the preservation and application of threat context, not a trained model.

### 6.4 External services

None.

### 6.5 Storage

No persistent storage. Scenario fixtures and policy are bundled with the application. Current UI state remains in browser memory.

### 6.6 Integrations

None in the MVP. The exported decision JSON, if implemented, is the only demonstration of an integration boundary.

---

## 7. Technology Choices

### React

- **Purpose:** Build the interactive comparison workspace.
- **Why chosen:** Familiar, fast component composition and reliable state-driven rendering.
- **Why simpler alternatives were rejected:** Static HTML would reduce setup but make synchronized scenario controls, reusable factor cards, and derived decision states more error-prone. A larger application framework adds routing and server features that are not required.
- **Implementation complexity:** Low.

### Vite

- **Purpose:** Local development and production bundling.
- **Why chosen:** Minimal configuration and fast startup for a client-only TypeScript application.
- **Why simpler alternatives were rejected:** A script-tag prototype would reduce tooling but weaken type safety and maintainability for the policy engine. Full-stack build systems add unnecessary server behavior.
- **Implementation complexity:** Low.

### TypeScript

- **Purpose:** Define strict scenario, factor, policy, evaluation, and decision contracts.
- **Why chosen:** The product depends on enumerated states and deterministic rules. Compile-time checks reduce accidental mismatch between policy output and UI rendering.
- **Why simpler alternatives were rejected:** Plain JavaScript is initially faster but increases the chance of silent state and reason-code errors during rapid iteration.
- **Implementation complexity:** Low.

### CSS with a small utility layer

- **Purpose:** Produce a polished, responsive security-decision interface.
- **Why chosen:** Native CSS or an already-available lightweight utility setup is sufficient for two panels, cards, chips, and states.
- **Why simpler alternatives were rejected:** Unstyled browser defaults would reduce judge impact. A full component system risks visual sameness and unnecessary dependency setup.
- **Implementation complexity:** Low.

### Vitest

- **Purpose:** Test the pure decision engine and scenario invariants.
- **Why chosen:** It integrates naturally with Vite and runs TypeScript tests with little configuration.
- **Why simpler alternatives were rejected:** No tests would make the central claim vulnerable to last-minute rule regressions. A heavier test stack is unnecessary.
- **Implementation complexity:** Low.

### Explicitly rejected technologies

- **Express or another backend:** No server responsibility exists.
- **SQLite or another database:** No persistent data is required.
- **WebAuthn libraries:** Real factor execution is outside the proof.
- **Charting libraries:** The UI shows evidence and discrete states, not unsupported probabilities.
- **LLM APIs:** Explanations must be deterministic and demo-safe.
- **State-management libraries:** Local component state and derived engine output are sufficient.

---

## 8. Engineering Trade-offs

### Threat inference is narrowed to deterministic demonstration rules

The system does not estimate real-world fraud probabilities. It classifies a seeded scenario into a ranked hypothesis using explicit rules.

**Accepted limitation:** The prototype demonstrates policy behavior after signals exist; it does not validate signal quality or detect fraud.

### Assurance is a gate, not an optimization target

A factor must meet the required assurance level. Among qualifying factors, the engine selects the first factor in a fixed, visible preference order.

**Accepted limitation:** Preference is policy-defined rather than empirically optimized. This is more honest than invented completion-time metrics.

### Factor compatibility is intentionally narrow

The policy supports only the two defined attack variants and their documented factor failure reasons.

**Accepted limitation:** The matrix is not a universal threat model. Unsupported threats return `insufficient evidence` and a conservative fallback rather than an invented decision.

### No general factor independence claim

The product evaluates single-factor paths only and does not claim that tagged dependency channels prove independence.

**Accepted limitation:** Multi-factor composition is postponed until a production threat model and authentication context exist.

### The baseline is deliberately limited but fair

The scalar baseline receives only aggregate risk and assurance requirements, so it cannot produce attack-specific explanations. It is not configured to choose an obviously unsafe factor.

**Accepted limitation:** The comparison proves information loss in scalar-only input, not superiority over every existing identity platform.

### No live factor execution

The selected factor is displayed, not executed.

**Accepted limitation:** The demo proves policy selection, not authentication security. This removes the highest-risk dependency from the critical path.

### No persistence

Refresh restores fixture state.

**Accepted technical debt:** None for the demo. Persistence would be required only for real users, policy editing, audit history, or authentication challenges.

### Assumptions

- Seeded indicators are accepted as inputs from an upstream fraud or device-signal system.
- The two attack variants are defined narrowly enough for the factor mappings to be defensible.
- Passkey enrollment is available in the default hero state.
- Assisted recovery is an external operational path and does not need implementation.
- Judges evaluate the policy insight and interaction, not production readiness.
- The application runs locally with no network dependency.

---

## 9. Demo Strategy

### Opening hook

Show two high-risk payment cards side by side and say:

> These payments have the same risk score. Should they receive the same authentication challenge?

Do not begin with architecture, AI, or regulation.

### Core workflow

1. Point out the shared aggregate risk and assurance requirement.
2. Reveal that the left event contains a recent SIM change while the right contains phishing-relay evidence.
3. Show the scalar baseline returning the same requirement for both because it sees only severity.
4. Run the threat-aware decision.
5. Follow the five-stage trace on each panel.
6. Emphasize the precise reason SMS was excluded in each case.

### Wow moment

Toggle off passkey enrollment on the SIM-swap panel.

The engine should not fall back to SMS merely because passkey is unavailable. It keeps SMS excluded and changes the outcome to:

`Payment paused -> assisted recovery`

This proves the policy does not choose an unsafe method to preserve completion.

### Ending

Close on the comparison view with the tagline:

> Risk tells you how worried to be. Threat context tells you what not to trust.

Then state the product boundary clearly:

> This prototype does not detect fraud or replace an identity provider. It is the decision layer that turns existing threat evidence into an explainable factor policy.

---

## 10. Success Criteria

The project is complete only when all must-build criteria below pass.

### Functional acceptance criteria

1. The application loads locally with no external API, account, database, or network dependency.
2. Both hero scenarios are visible on one comparison screen.
3. Both scenarios display the same aggregate risk and required assurance.
4. Scenario A derives `SIM channel compromise` from the recent-SIM-change evidence.
5. Scenario B derives `phishing` from the phishing-relay evidence.
6. The engine does not display decimal probabilities or describe outputs as calibrated.
7. SMS OTP is excluded in both scenarios, with a different scenario-specific reason trace.
8. Passkey is selected only when it is both threat-compatible, enrolled, and above the assurance threshold.
9. Turning passkey enrollment off changes passkey to `unavailable` without changing the threat hypothesis.
10. When no executable factor survives, the outcome is `payment paused and referred to assisted recovery`, not permanent account lockout.
11. The scalar baseline receives no raw threat indicators and returns the same assurance requirement for both scenarios.
12. Every factor evaluation has exactly one state: `eligible`, `excluded`, or `unavailable`.
13. Every excluded or unavailable factor has at least one stable reason code and one plain-language reason.
14. Identical scenario and policy inputs always produce identical decision output.
15. Reset restores the known hero state without reloading external data.

### Engineering acceptance criteria

1. The decision engine is a pure function with no UI, storage, time, random, or network dependency.
2. Scenario fixtures, policy rules, and UI components are separated.
3. The policy includes a visible version identifier.
4. Automated tests cover both hero scenarios, the passkey-unavailable path, the insufficient-evidence path, and deterministic output.
5. No code path can select a factor marked threat-incompatible or unavailable.
6. No unsupported threat is silently mapped to a confident decision.

### Demo-quality acceptance criteria

1. A viewer can understand `same risk, different threat context` from the default screen without opening another page.
2. The complete demo can be performed using only preset controls.
3. No loading spinner, permission prompt, browser authenticator dialog, login, or network request is on the demo path.
4. Seeded indicators and simulated outcomes are visibly labeled.
5. The factor-elimination trace is readable at presentation size.
6. The presenter can reset the application immediately after any interaction.

### Product integrity acceptance criteria

1. The product never claims to detect a SIM swap, phishing attack, or fraud event.
2. The product never claims that its confidence bands are calibrated probabilities.
3. The product never claims that passkeys are safe against every device-compromise scenario.
4. The product never claims compliance, production readiness, or universal factor independence.
5. The comparison does not depend on an intentionally unsafe or incompetent baseline.

---

## Final Scope Validation

The final product contains one screen, two scenarios, three outcomes, one deterministic decision engine, one static policy, and one memorable interaction.

Anything that does not strengthen the visible chain from **evidence** to **factor exclusion** to **safe outcome** has been removed.
