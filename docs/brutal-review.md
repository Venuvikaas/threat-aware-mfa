# Brutal Engineering Design Review: Threat-Aware Intelligent MFA

**Reviewed artifact:** `threat-aware-intelligent-mfa-research-report.md`  
**Review posture:** Staff Software Engineer, Technical Architect, Startup CTO, Hackathon Judge, and ruthless Product Manager  
**Decision:** **Reject as currently scoped. Conditionally approve only after severe scope reduction and correction of the core demo logic.**

## Executive Verdict

The document is thoughtful, unusually self-aware, and far too large for a hackathon. It reads like a research report, security architecture proposal, compliance positioning paper, product strategy document, implementation plan, and demo script compressed into one artifact. That breadth creates the illusion of completeness while hiding the central problem: **the project has not yet proved that its key decision is correct, differentiated, or demonstrable with credible inputs.**

The core idea is understandable:

> Do not select an authentication factor only from aggregate risk. First infer the likely attack, then eliminate factors that the attack may have compromised.

That is a legitimate policy abstraction. It is not yet a product. The PRD assumes that reliable attack-type signals exist, that the mapping from threats to compromised factors is defensible, that factor independence can be represented with simple labels, and that the resulting recommendation is safer than a conventional policy. Those are the hardest parts of the project, but the document treats them largely as configurable tables.

The proposed demo then weakens its own case by constructing a deliberately bad baseline that sends SMS OTP during a SIM-swap scenario. Judges with security experience may see this as a strawman. Judges without security experience may miss the distinction entirely and only see a dashboard that routes between authentication methods using seeded values.

The project is currently over-scoped in implementation and under-proven in its central claim. Six days spent building WebAuthn, TOTP, PIN storage, transaction binding, factor-pair independence, counterfactuals, a baseline engine, a decision ledger, multiple personas, charts, animations, and a second-device simulation will likely produce a broad but fragile demo. The result may look technical without proving anything difficult.

The project should not be approved in its present form.

---

# 1. Product Review

## 1.1 Is the problem worth solving?

**The underlying problem is worth solving. The proposed product boundary is not yet convincing.**

Authentication systems do need to avoid relying on a channel suspected of compromise. The statement "risk tells you how worried to be; a threat profile tells you what not to trust" is the strongest part of the concept. It is memorable and gives the demo a clean conceptual contrast.

However, the PRD jumps from a valid security principle to a standalone product without proving that a separate orchestration layer is needed. A bank can already encode rules such as:

- Recent SIM change means do not use SMS OTP.
- Suspected phishing means require an origin-bound factor.
- Untrusted device means do not approve solely on that device.
- Missing enrollment means offer another permitted factor.

Your proposal may simply be a more explicit policy model for rules that already belong inside a fraud engine, identity platform, or authentication journey. That can still be useful, but it is a narrower claim than the document makes. The actual product may be **a policy decision component and explanation visualizer**, not a new intelligent MFA system.

The document also conflates three problems:

1. Inferring the likely attack.
2. Deciding which factors remain eligible.
3. Executing the selected authentication challenge securely.

Each is a substantial product area. The PRD treats ownership of all three as necessary. It is not. For a hackathon, owning all three damages focus.

## 1.2 Is the target user too broad?

Yes.

The primary persona is an authentication product owner, but the product simultaneously aims to serve fraud analysts, compliance reviewers, security reviewers, and end customers. These users do not share the same workflow, information density, or interface.

The PRD lists practically every stakeholder near digital-payment authentication. That is not segmentation. It is organizational mapping.

The actual hackathon user should be one of these:

- **Authentication policy designer:** needs to test which factors survive under a scenario.
- **Fraud decision engineer:** needs a machine-readable decision from existing threat indicators.
- **Security reviewer:** needs to inspect why a factor was selected or excluded.

Trying to serve the end customer in the same MVP adds challenge screens, recovery concerns, accessibility behavior, messaging, and completion flows. None of that proves the core decision engine.

The strongest choice is the **authentication policy designer or fraud decision engineer**. The customer UI should be a minimal demo surface, not a separate product persona.

## 1.3 Is the MVP too large?

Massively.

The "must build" list contains:

- Three personas.
- A threat inference engine.
- A factor registry.
- Threat compatibility filtering.
- Capability filtering.
- Independent factor-combination generation.
- Assurance selection.
- Friction tie-breaking.
- Hard-block logic.
- Explanations.
- Counterfactuals.
- A baseline engine.
- A decision ledger.
- Real WebAuthn.
- TOTP.
- PIN handling.
- Simulated out-of-band confirmation.
- Transaction binding.
- Split-screen comparison.
- Charts.
- Animation.
- Scenario controls.
- Security tests.
- A regulatory framing layer.

That is not an MVP. That is an abbreviated platform roadmap.

Several items are individually capable of consuming a disproportionate amount of build and debugging time. WebAuthn origin configuration, credential enrollment state, challenge persistence, transaction mutation invalidation, second-device flows, and factor-combination logic are not harmless checkboxes.

## 1.4 Which features are unnecessary?

### Remove immediately

#### 1. TOTP and PIN as real authentication adapters

They add implementation, storage, rate limiting, secret handling, and UI work, but they do not strengthen the core claim. The demo is about **selection**, not about proving that the team can implement standard OTP and password verification.

Represent them as factor definitions and simulated outcomes. Do not build full adapters.

#### 2. General factor-pair generation

`buildIndependentOptions()` sounds architecturally mature and is likely to become a combinatorial policy swamp. For the demo, define at most three explicitly allowed paths. General combination search is not needed.

#### 3. Three detailed personas

Priya is sufficient for the hero demo. Lakshmi can be a short second scenario if inclusion is part of the judging rubric. Ravi is weak, ambiguous, and technically dangerous because the document cannot cleanly prove what a remote-access indicator compromises.

#### 4. Full counterfactual generation for every rejected factor

Reason codes are useful. Counterfactuals for every factor are excessive and will clutter the interface. One focused explanation is enough:

> SMS OTP was excluded because a recent SIM change is present. Without that indicator, SMS OTP would be eligible under policy version X.

Do not generate a wall of obvious counterfactuals.

#### 5. Decision ledger as a product feature

Store one decision JSON for display and debugging. Do not build a ledger concept, replay interface, version browser, or audit product.

#### 6. Friction optimization based on `expectedSeconds`

The values will be invented. Sorting by fabricated seconds does not make the system intelligent. It gives judges another arbitrary table to challenge. Use a simple fixed preference order after security eligibility, or label friction as a static demo policy.

#### 7. Regulatory-principle card

This is pitch support, not a core feature. It can appear on one slide. It should not consume application UI space or implementation time.

#### 8. Factor-exclusion animation

Animation is polish after the logic is stable. A clear three-step list is enough. Animation is a classic hackathon time sink that produces visual motion instead of evidence.

## 1.5 What should be cut immediately?

Cut the MVP to this:

1. One hero scenario: recent SIM change.
2. One comparison scenario: same aggregate risk, different threat composition.
3. A deterministic indicator-to-threat calculation.
4. A small factor matrix with three factors: SMS OTP, passkey, and assisted recovery or block.
5. A selector that excludes incompatible factors.
6. A transparent reason trace.
7. Optional real WebAuthn only after the complete simulated decision demo works.

Everything else is secondary.

## 1.6 Product decisions that are not justified

### "Select the highest-assurance valid option"

This conflicts with the repeated positioning around the "lowest-friction valid option." The pseudocode sorts by assurance first, then by friction. That means a higher-assurance option always wins even if a lower-assurance option already satisfies policy and is much easier. Your product language promises one behavior while the algorithm implements another.

You need one rule:

- Either choose the **lowest-friction option that meets required assurance**, or
- choose the **highest-assurance option and use friction only as a tie-breaker**.

For a payment product claiming minimal friction, the first is more coherent. The current PRD is internally inconsistent.

### "Threat profile" as a probability vector

The numbers look scientific but are not calibrated. Calling them normalized likelihood-table outputs does not fix the perception problem. A value such as `sim_swap: 0.62` invites questions about data, validation, false positives, threshold sensitivity, and calibration. You do not have good answers because the values are seeded.

A ranked hypothesis with evidence may be more credible than fake precision:

- SIM swap: high support.
- Device compromise: weak support.
- Phishing: no direct support.

The current decimal outputs create more credibility risk than value.

### Hard block when no valid factor survives

Security teams understand this. Product judges may ask what happens to a legitimate user. The PRD postpones account recovery while making blocking a central outcome. That leaves the product incomplete at the exact moment a customer needs it most.

For the hackathon, "refer to assisted recovery" is more defensible than an absolute dead end. You do not need to implement recovery, but the policy outcome should distinguish **payment blocked** from **customer permanently locked out**.

---

# 2. Architecture Review

## 2.1 Is the architecture overengineered?

The deployment architecture is not overengineered. The internal domain architecture is.

Choosing a modular monolith, localhost deployment, SQLite, and no event system is correct. The document deserves no credit for rejecting Kafka, blockchain, agents, vector search, microservices, and Elasticsearch because none of them were plausible requirements in the first place. Listing technologies you correctly decided not to use makes the report longer without making the design better.

Inside the monolith, there are too many conceptual modules for the actual demo:

- Indicator Extractor
- Threat Inference Module
- Factor Registry
- Capability Filter
- Threat Compatibility Filter
- Independence Validator
- Assurance and Friction Selector
- Counterfactual Generator
- Authentication Adapters
- Decision Ledger

For a tiny scenario set, these can collapse into four components:

1. Scenario input.
2. Threat classifier or scorer.
3. Policy evaluator.
4. Decision trace.

Separate files are fine. Separate architectural boxes are unnecessary.

## 2.2 Technologies that appear impressive but add little value

### WebAuthn

WebAuthn is legitimate security technology, but in this PRD it risks becoming a credibility prop. The core project is not a passkey implementation. If origin, browser profile, enrollment, or authenticator behavior fails during the demo, the entire story stops at a standard integration issue unrelated to your innovation.

A real passkey interaction is useful only if:

- It is completed after the selector chooses it.
- It is stable on the exact presentation setup.
- It does not consume time needed to prove the selector.

Otherwise, simulate the factor execution and demonstrate a signed, transaction-bound challenge as pre-recorded evidence or a secondary flow.

### SQLite

SQLite is fine, but the project may not need a database at all. JSON fixtures plus an in-memory decision result are simpler. Use SQLite only if credential persistence is required for real WebAuthn. Do not add persistence merely because the data model section exists.

### Express

Express is acceptable, but even the backend is optional for the initial core. The selection engine can be a pure TypeScript package invoked by the frontend. Add a server only for WebAuthn challenge handling or secure persistence.

### React visualization ecosystem

Charts are not automatically useful. A threat-profile chart displaying arbitrary decimals may decorate an unvalidated model. A decision trace with evidence and exclusions is more defensible than a radar chart or animated bars.

## 2.3 Components to remove

Remove or collapse:

- Separate persona module.
- General indicator extractor for manually seeded form inputs.
- General independence validator.
- General factor adapter interface.
- TOTP adapter.
- PIN adapter.
- Counterfactual service.
- Decision ledger abstraction.
- Database, unless real WebAuthn requires persistence.
- Baseline persistence.

## 2.4 Simpler architecture

```text
React/Vite UI
    |
    +-- Scenario fixtures
    +-- Pure TypeScript decision engine
    |      +-- threatScore(indicators)
    |      +-- eligibleFactors(threat, capabilities)
    |      +-- chooseFactor(requiredAssurance)
    |      +-- decisionTrace()
    |
    +-- Optional WebAuthn API
           +-- challenge store
           +-- credential store
```

The decision engine should accept one JSON object and return one JSON object. No database is needed for the policy demo. No general-purpose orchestration platform is needed.

## 2.5 Architecture flaws hidden by clean diagrams

### Threat thresholds are missing

The selector calls `isCompatibleWithThreats(factor, threatProfile, policy)`, but the hard part is omitted. What threshold excludes a factor? Does `sim_swap: 0.31` eliminate SMS? What if `sim_swap: 0.31` and `phishing: 0.29` together eliminate every available factor? Is exclusion based on the top threat, every threat above a threshold, expected loss, or worst case?

This is not a detail. It is the actual decision architecture.

### Independence is modeled too casually

`dependencyChannels: ["device"]` is too coarse. Two factors can share the same device but use different credentials and security properties. Two nominally different devices can share the same compromised account, cloud recovery path, telecom identity, or session. Independence is contextual, not a simple set-intersection test.

For the hackathon, avoid claiming you have solved factor independence generally. Demonstrate one explicit policy rule and label it as such.

### Capability and trust are mixed

"Can the user complete this factor?" and "is this factor safe under the suspected threat?" are different axes. The PRD recognizes both but some scenarios blur device capability, enrollment, user accessibility, and channel trust. Keep these separate in the data and the UI.

### Transaction binding is detached from factor semantics

The PRD says every selected challenge is bound to transaction ID, amount, recipient, version, expiry, and nonce. That does not mean the user authenticator actually displays or cryptographically verifies all those details. Storing fields next to a challenge in a database is not equivalent to dynamic linking or transaction confirmation.

If the passkey signs a server challenge derived from transaction data, you must explain exactly what property is guaranteed and what the user saw. Otherwise, "transaction-bound" may be challenged as an overclaim.

---

# 3. Engineering Review

## 3.1 Underestimated technical risks

### 1. The threat model is the product, and it is not specified

You list threats and factor properties, but do not define attacker capabilities precisely. "Device compromise," "phishing," and "stolen device" are broad categories. A factor can be safe against one variant and unsafe against another.

For example, a passkey may resist credential phishing, but the transaction can still be manipulated before authentication if the application or device is compromised. A statement such as "passkey survives device compromise" would be indefensible without a narrow threat definition.

You need a threat model before code:

- What does the attacker control?
- Which channel is compromised?
- What secrets or sessions can the attacker access?
- What user interaction can the attacker influence?
- What does a successful defense mean?

### 2. The inference values are arbitrary

The document admits this risk but does not solve it. Showing the likelihood table only proves transparency, not correctness. Judges can still ask why a recent SIM change contributes a particular weight or why those priors were chosen.

The safest engineering choice is to treat the threat inference as a **demonstration policy**, not an AI model. If the hackathon expects AI, this project currently has weak AI substance.

### 3. Signal provenance is absent

The system depends on recent SIM change, geo velocity, remote-access indicators, stolen-device indicators, and device trust. Most are seeded. Once seeded, the system is not detecting threats. It is demonstrating what it would do if another system had already detected them.

That is acceptable if stated clearly, but it reduces the product to a policy engine. Do not imply end-to-end threat awareness.

### 4. WebAuthn state handling

Potential failure points include:

- Relying-party ID mismatch.
- Origin mismatch.
- Browser privacy behavior.
- Credential enrollment state.
- Challenge expiry.
- Challenge lookup.
- Authenticator availability.
- User-verification configuration.
- Localhost versus HTTPS behavior.
- Presentation-machine profile changes.

The PRD acknowledges origin risk but still makes real WebAuthn a must-build credibility anchor. That is poor prioritization.

### 5. Transaction mutation and replay

"Transaction edits invalidate the challenge" requires strict state ownership. The transaction version used during challenge creation must be checked atomically during verification. If this is implemented casually in frontend state, the security claim is false. If implemented correctly, it adds backend state, error paths, and tests.

### 6. Out-of-band simulation

Two tabs on the same machine prove nothing about independence. Even a second device connected to the same demo backend does not automatically prove an independent trust domain. This feature invites more criticism than it resolves.

### 7. Policy explosion

Once factors have assurance, channels, properties, capabilities, threats, thresholds, pair compatibility, and friction, contradictory policies become likely. The PRD has no conflict-resolution model beyond sorting survivors.

### 8. False-block behavior

Threshold uncertainty can remove every factor. The system's confidence and consequence are mismatched: an uncalibrated threat estimate can trigger a deterministic block. The PRD mentions uncertainty thresholds but does not define them.

## 3.2 Integrations likely to fail

### Real WebAuthn

Most likely to fail during setup or live presentation. It should be optional, isolated, and never on the critical path to showing the decision.

### Live second-device confirmation

Network discovery, HTTPS, session correlation, QR handoff, and second-device state can all fail. Do not build this unless it is the entire project.

### Carrier SIM-swap API

Correctly postponed. Keep it postponed. Any attempt to add it late is reckless.

### Geolocation or device-security signals

Also correctly postponed. Seed them and label them visibly.

## 3.3 Unvalidated assumptions

1. A meaningful attack-type profile can be inferred from the available signals.
2. Judges will accept seeded likelihoods as "intelligence."
3. Existing adaptive authentication systems primarily operate as naive scalar ladders.
4. A simple factor-property matrix can encode real compromise relationships.
5. The same aggregate risk with different threat composition is a common enough operational case to justify a new layer.
6. Product owners want a new orchestrator rather than better policy support in existing platforms.
7. Counterfactuals materially improve decisions rather than merely adding explanation text.
8. Expected completion time can be represented by one static number per factor.
9. A passkey is the correct survivor in the selected SIM-swap scenario.
10. Users have a passkey enrolled when SMS is excluded.
11. A simplified baseline will be viewed as educational rather than manipulative.
12. Transaction binding can be implemented and explained accurately within the hackathon.
13. Factor independence can be demonstrated without production identity and recovery context.

## 3.4 Unknowns to test first

Test these before building UI polish:

### Test 1: Can five people understand the difference in 20 seconds?

Show identical risk scores with two different attack hypotheses and ask which authentication factor should be used. If the distinction requires a long lecture, the demo is too abstract.

### Test 2: Does the rule produce non-obvious, defensible outputs?

Run at least ten scenario combinations. Look for contradictions, empty survivor sets, and cases where the selector chooses an obviously impractical factor.

### Test 3: Can a security reviewer attack the factor matrix?

Ask someone to challenge every mapping. If the answer is repeatedly "it depends," narrow the threat definitions rather than adding more properties.

### Test 4: Does the demo work without WebAuthn?

If no, the architecture is backwards. The value proposition must survive as a decision demo even when factor execution is simulated.

### Test 5: Is the baseline fair?

Compare against a reasonable rules-based baseline, not one intentionally configured to fail. Otherwise the project wins only because it controls both sides of the comparison.

### Test 6: Is there a coherent answer to confidence?

Define exactly when a threat score excludes a factor. Test values around the threshold. If a one-point change flips approval to block, show that honestly.

---

# 4. Hackathon Strategy Review

## 4.1 Features least likely to impress judges

### Full data model

Judges will not care that there are tables for personas, indicators, profiles, decisions, and challenges. Schema volume is not product value.

### Decision ledger

Unless auditability is a scored criterion and visibly demonstrated, this is backend plumbing.

### PIN hashing and TOTP rate limiting

Necessary in production, irrelevant to the hero idea, and invisible in a short demo.

### Generic adapter interface

Good software hygiene, zero demo impact.

### Counterfactual for every factor

Likely to become text-heavy and repetitive.

### Regulatory card

Useful as verbal support, weak as a feature.

### Threat-profile chart

Potentially harmful if it emphasizes invented precision.

### Three personas

Judges remember one story. Three scenarios can dilute the narrative and increase failure surface.

## 4.2 The hero demo

The hero demo should be:

> Two transactions have the same aggregate risk score, but one indicates SIM-swap risk and the other indicates phishing. A conventional severity-only policy asks for the same step-up method. The threat-aware policy excludes different factors and produces different defensible outcomes, with a visible execution trace.

The hero component is not WebAuthn. It is the **factor elimination trace**:

```text
Observed evidence
  -> likely threat
  -> compromised dependency
  -> excluded factor
  -> surviving option
  -> decision
```

The best visual is not a large dashboard. It is a compact side-by-side diff that highlights exactly one changed signal and exactly one changed factor decision.

## 4.3 What should be postponed?

Postpone all of the following until the core decision trace is complete and stable:

- Real TOTP.
- Real PIN verification.
- General factor-pair generation.
- Second-device flow.
- Full transaction-binding implementation.
- Database-backed decision ledger.
- Three-persona navigation.
- Counterfactuals for every rejection.
- Animations.
- Policy administration.
- Detailed compliance UI.
- Remote-access scenario.
- Accessibility scenario unless required by judging criteria.

Real WebAuthn is the only optional integration worth adding, and only after the decision demo is finished.

## 4.4 Where build time is being wasted

The PRD spends substantial attention demonstrating architectural restraint against technologies nobody asked for. It also specifies production concerns such as multi-region consistency, policy rollout, carrier integrations, encryption of TOTP secrets, and account recovery at scale. Those sections do not help finish the hackathon project.

Engineering time will be wasted on:

- Authentication adapter generality.
- Persistence that exists only to support the model diagram.
- Multiple polished scenario flows.
- Perfecting factor metadata.
- Building a baseline engine as if it were a real competing product.
- Making arbitrary likelihoods look mathematically sophisticated.
- Trying to prove "AI" through normalized tables.

## 4.5 The baseline is a strategic liability

The proposed baseline says:

```text
High risk -> stronger challenge -> SMS OTP -> approved
```

This is inconsistent even with the PRD's earlier suggested baseline of "high risk -> biometric + OTP." More importantly, it appears designed to lose. A judge may reasonably ask why any high-risk policy would blindly choose SMS after receiving a recent SIM-change indicator.

If the baseline is a scalar engine, it should receive only the scalar score, not the raw indicators. State this explicitly. Even then, compare against a plausible policy such as:

- High risk requires a predefined phishing-resistant factor.
- Threat-aware policy chooses among allowed factors based on the suspected compromise.

The threat-aware engine must win by being more precise, not because the baseline is incompetent.

## 4.6 Three-minute demo critique

Act 1 is emotionally clear but technically suspect. Saying the attacker receives SMS OTP and the transfer is approved compresses several unstated assumptions. A SIM swap usually gives control of the number, but the demo must show that the attack condition is supplied as an indicator, not discovered by your system.

Act 2 is the strongest section, but the decimal threat profile may slow the audience. The essential moment is SMS exclusion.

Act 3 is too much. The inclusion story introduces another persona, capability model, and different objective. It weakens the security story immediately before the close.

A tighter sequence:

1. One transaction and one scalar risk.
2. Show the conventional fixed step-up result.
3. Reveal the recent SIM-change evidence.
4. Show SMS removed and passkey retained.
5. Change only the attack evidence to phishing or device compromise.
6. Show a different factor outcome at the same risk level.
7. Close with the tagline.

---

# 5. Execution Risk Under Six Days

## 5.1 What will almost certainly fail?

### A complete, polished implementation of every must-build item

The scope is too broad. Even if all components exist, they will not all be credible, tested, and demo-safe.

### General factor independence

You will either oversimplify it or spend too much time defining exceptions.

### Real WebAuthn plus robust transaction binding

Possible, but dangerous when combined with the rest of the scope. The integration may work while the actual product logic remains shallow.

### A credible threat inference model

Without data, the system cannot establish calibrated probabilities. At best it can demonstrate transparent rule-based evidence weighting.

### A truthful second-device independence claim

A hackathon setup cannot establish the full trust properties implied by the architecture.

### Comprehensive security testing

The listed tests are reasonable, but six days will force shortcuts. Claims should be reduced to what is actually tested.

## 5.2 Dangerous dependencies

1. Browser and platform WebAuthn behavior.
2. Exact origin and relying-party configuration.
3. Authenticator availability on the presentation laptop.
4. Any networked second-device flow.
5. Native modules such as `better-sqlite3`, `argon2`, or build-tool compatibility.
6. QR and TOTP library integration if added.
7. Deployment-platform HTTPS and environment configuration.
8. External signal APIs, if anyone attempts to reintroduce them.
9. Presentation browser profile retaining enrolled credentials.
10. Any LLM-generated explanation added at the last minute.

## 5.3 Correct task order

### First: Write the threat model and policy matrix

Do this before UI or authentication integration. Use one narrow attack variant per threat. Define attacker control and exact factor failure reason.

### Second: Implement the pure decision kernel

Input JSON to output JSON. Add scenario and invariant tests. No React. No database. No WebAuthn.

### Third: Validate the hero comparison

Prove that equal aggregate risk can produce different factor eligibility and that the output is defensible.

### Fourth: Build the minimal UI

Display inputs, threat hypothesis, excluded factors, selected factor, and reason trace. No animation.

### Fifth: Create a deterministic demo mode

One click loads each scenario. Reset is immediate. No external services.

### Sixth: Add real WebAuthn only if the preceding system is complete

Keep it behind a feature flag. The simulated completion flow must remain available and clearly labeled.

### Seventh: Add polish

Only now add visual transitions, a second scenario, or regulatory context.

## 5.4 Ruthless six-day scope

### Day-one deliverable

A command or test that takes two scenario JSON files with the same scalar risk and returns different factor decisions with explicit reasons.

### Minimum credible product

- Two scenarios.
- Three factor definitions.
- One narrow threat matrix.
- One policy threshold.
- One decision trace.
- One side-by-side screen.
- No external dependencies.

### Stretch goal

One real passkey challenge bound to an immutable transaction summary.

Everything beyond that is optional.

---

# 6. Specific Contradictions and Design Defects

## 6.1 Selection objective contradiction

The positioning says "select the lowest-friction path that still satisfies required assurance." The pseudocode selects the highest assurance first and uses friction only for a tie. These are different products.

**Severity:** Critical.  
**Required correction:** Define one objective function and use it consistently in positioning, policy, pseudocode, tests, and demo.

## 6.2 Baseline inconsistency

The MVP baseline says high risk produces biometric plus OTP. The demo later shows high risk producing SMS OTP alone.

**Severity:** Critical for judge trust.  
**Required correction:** Use one baseline and explain exactly which inputs it receives.

## 6.3 "AI" ambiguity

The AI section describes likelihood-table inference with seeded inputs and no calibrated data. This may be viewed as weighted rules labeled as intelligence.

**Severity:** High if AI is central to judging.  
**Required correction:** Call it transparent probabilistic scoring or evidence-weighted policy inference. Do not sell it as a trained model.

## 6.4 Passkey outcome ambiguity

The Priya scenario says the passkey is selected, then says the attacker cannot complete it so the payment is blocked. The user experience is unclear. Is Priya present? Is the attacker initiating the transfer remotely? Is the passkey on a trusted device or the new device? Why is it available to the legitimate user but not the attacker?

**Severity:** Critical to the hero story.  
**Required correction:** Define the actor, device, credential location, and transaction initiation path.

## 6.5 Assurance and factor-count ambiguity

The selector separately considers `requiredFactorCount` and `requiredAssurance`, but the PRD does not define how assurance aggregates across factors. Adding two weak factors does not necessarily equal one strong factor.

**Severity:** High.  
**Required correction:** Avoid generic assurance arithmetic. Use explicit allowed combinations for the prototype.

## 6.6 Independence overclaim

A dependency-channel list is insufficient evidence that compromise of one factor does not affect another.

**Severity:** High.  
**Required correction:** Demonstrate one narrow independence rule, not a universal validator.

## 6.7 Transaction binding overclaim

Including transaction fields in challenge state does not by itself prove that the authenticator verified or displayed those fields.

**Severity:** High.  
**Required correction:** State the exact binding mechanism and user-visible confirmation, or reduce the claim.

## 6.8 Capability story conflicts with assurance policy

Lakshmi has no passkey and no fingerprint route. The PRD does not show which remaining factor satisfies the same required assurance or why a low-friction path is safe.

**Severity:** Medium to high.  
**Required correction:** Provide an explicit eligible factor and required assurance for that scenario, or remove it.

## 6.9 Threat classes are not mutually exclusive

SIM swap, phishing, device compromise, and stolen device can co-occur. Normalizing them into a distribution that sums to one implies competition between hypotheses even when multiple attacks or conditions may be present.

**Severity:** High.  
**Required correction:** Use independent evidence scores or explicitly state that the model selects among mutually exclusive scenario hypotheses for demonstration only.

## 6.10 "Benign" is not the same kind of category

Benign is a state of no attack, while the others are attack classes. Combining them in a single normalized vector may be acceptable for a toy classifier but needs a defined interpretation.

**Severity:** Medium.  
**Required correction:** Separate attack likelihood from attack-type distribution, or simplify to ranked hypotheses.

---

# 7. Approval Decision

## Would I approve this as an engineering lead?

**No, not at current scope.**

Reasons:

1. The core threat-to-factor policy is underspecified.
2. The system's most important inputs are seeded and externally unavailable.
3. The inference outputs look more precise than the evidence supports.
4. The factor-independence model is too coarse for the claim being made.
5. The selection objective contradicts the product positioning.
6. The baseline changes between sections and risks being a strawman.
7. The hero scenario does not clearly define who controls which device and credential.
8. The must-build list is too large for six days.
9. Standard authentication integrations are being confused with product differentiation.
10. The demo has too many opportunities to fail for reasons unrelated to the idea.

I would approve a reduced experiment with a narrow charter:

> Demonstrate that attack-specific evidence can change factor eligibility even when aggregate risk is unchanged, using a transparent deterministic policy and a visible reason trace.

That is buildable, testable, and judgeable.

## Would I approve this as a hackathon judge?

**Not based on the PRD alone.**

I would be interested in the tagline and the side-by-side concept. I would then challenge the team on four points:

1. Where do the threat signals come from?
2. Why should I trust the threat scores and thresholds?
3. Is the baseline intentionally weak?
4. What has the team built that existing policy engines cannot express?

The current document does not have strong enough answers. It repeatedly acknowledges limitations, which is honest, but acknowledgment is not differentiation.

A judge may conclude that the system is a rules engine over mocked signals with a polished MFA demonstration. That is the failure mode you need to design against.

## Would I approve this as a startup CTO?

**No.**

The buyer, integration point, data access model, deployment boundary, and liability model are unclear. Banks do not casually insert a new authentication orchestrator into payment authorization. Integration and trust would dominate adoption. The document focuses on selector logic while underestimating enterprise integration, policy ownership, signal contracts, and operational accountability.

As a startup, this would need to become one of two things:

- A policy simulation and audit tool that evaluates existing authentication journeys, or
- An embeddable decision SDK that consumes already-available fraud hypotheses and returns factor eligibility with reason codes.

The second is closest to the hackathon concept, but the differentiation would need proof against existing identity-policy tooling.

---

# 8. Final Ruthless Recommendation

Do not build the PRD as written.

Build the smallest proof of the only claim that matters:

> Two events with equal risk severity can require different authentication factors because their suspected compromise paths differ.

The entire project should revolve around proving that statement fairly and visibly.

Keep:

- The tagline.
- The same-risk, different-threat comparison.
- The threat-to-factor incompatibility matrix.
- Capability filtering as a secondary axis.
- Deterministic reason traces.
- A modular monolith or frontend-only pure TypeScript kernel.

Cut:

- General factor-pair independence.
- TOTP and PIN implementations.
- The decision ledger product.
- Three full personas.
- The remote-access scenario.
- The second-device simulation.
- Full counterfactual coverage.
- Static friction timing.
- Animations before stability.
- Most of the database.
- Any claim of calibrated AI.
- Any unfair baseline.

Add before coding further:

- A narrow attacker model.
- Explicit factor-exclusion thresholds.
- A coherent selection objective.
- A fair baseline contract.
- A precise explanation of who owns each signal.
- A clear statement of what the prototype does not detect.
- A fallback outcome that distinguishes payment blocking from customer recovery.

## Final verdict

**Current project:** Reject.  
**Core concept:** Worth a sharply reduced prototype.  
**Current MVP feasibility in six days:** Poor.  
**Primary risk:** Building a large authentication demo around arbitrary threat inputs and calling the result intelligent.  
**Best chance of winning:** Turn it into a focused, transparent policy-decision demonstration with one unforgettable side-by-side failure case.  
**Most dangerous temptation:** Spending the hackathon proving that WebAuthn works instead of proving that your factor-selection logic is useful.
