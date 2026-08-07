# Threat-Aware Intelligent MFA
## Discovery Research Report for Problem Statement 5

**Tagline:** *The strongest factor and the appropriate factor are not the same thing.*

---

## Executive Summary

Threat-Aware Intelligent MFA is a digital-payment authentication orchestrator that challenges the usual adaptive-MFA model.

Most adaptive systems follow a vertical escalation ladder:

```text
Higher risk score
-> stronger or heavier authentication
```

The proposed system instead escalates sideways:

```text
Likely attack type
-> remove factors compromised by that attack
-> remove factors the customer cannot complete
-> verify factor independence
-> select the lowest-friction valid option
```

The engine does not reduce every event to one scalar risk score. It produces a **threat profile**, for example:

```json
{
  "sim_swap": 0.62,
  "device_compromise": 0.18,
  "phishing": 0.10,
  "stolen_device": 0.05,
  "benign": 0.05
}
```

This is important because two transactions can have the same overall risk while requiring completely different authentication methods. A recent SIM change should make SMS OTP ineligible. A phishing-relay pattern should remove phishable methods. A constrained device or unavailable biometric should remove methods the customer cannot complete.

The prototype combines:

- Threat-profile inference from transparent likelihood tables
- Threat-specific factor exclusion
- Customer capability filtering
- Factor dependency and independence checks
- Assurance-based selection
- Friction-based tie-breaking
- Deterministic counterfactual explanations
- Transaction-bound authentication
- A split-screen comparison against a conventional risk ladder

The regulatory framing is relevant. The Reserve Bank of India Authentication Mechanisms for Digital Payment Transactions Directions, 2025 became effective on April 1, 2026 and requires robust authentication arrangements where compromise of one factor does not affect the reliability of another.

The product should not claim that adaptive authentication, factor independence, transaction signing, or phishing-resistant MFA are new. Existing identity platforms already provide major portions of this space. The credible contribution is the combined decision abstraction:

> **Threat profile + factor failure properties + customer capability + independence + friction + counterfactual explanation.**

---

# 1. Problem Analysis

## 1.1 Exact problem

Current adaptive authentication commonly determines **how much authentication** to require, but may not adequately determine **which authentication mechanism remains trustworthy under the suspected attack**.

Typical adaptive flow:

```text
Signals
-> aggregate risk score
-> low, medium, or high risk
-> allow, step up, or block
```

Threat-aware flow:

```text
Signals
-> threat hypothesis profile
-> eliminate compromised factors
-> eliminate unavailable factors
-> enforce independence
-> select valid factor or factor pair
```

### Example failures of the vertical ladder

#### SIM swap

A recent SIM change raises transaction risk. A basic adaptive engine may respond by requesting SMS OTP. That can route the challenge through the suspected compromised channel.

#### Real-time phishing relay

OTP and simple push approval can be relayed or socially manipulated. An origin-bound WebAuthn credential has a different failure profile and may remain suitable.

#### Device-compromise indicators

If the current device or session is suspected of compromise, placing every challenge on the same device may fail the independence objective. The engine should prefer a separately trusted endpoint when one exists.

This does **not** mean that any remote-access application automatically defeats biometrics. The defensible claim is narrower: remote-access or device-compromise indicators reduce confidence in same-device approval paths.

#### Customer capability mismatch

A passkey cannot be used if none is enrolled. A camera-dependent method cannot be used when the camera is unavailable. A user requiring an alternative to fingerprint authentication should not be locked out when another method with equivalent assurance exists.

## 1.2 Who experiences the problem?

### Customers

- Digital-wallet users under account-takeover attempts
- Victims of SIM-swap fraud
- Customers targeted by phishing or social engineering
- Users with constrained or older devices
- Customers unable to complete a prescribed biometric method
- Users on unreliable networks
- Customers locked out by an inappropriate authentication requirement

### Organizations

- Banks
- Digital-wallet providers
- Payment-system operators
- FinTech authentication teams
- Fraud-risk teams
- Customer-support teams
- Compliance and security-audit teams

## 1.3 How the problem is currently handled

Existing identity and payment systems commonly use:

1. New-device detection
2. IP and network reputation
3. Impossible-travel detection
4. Device posture
5. Location or behavioral context
6. Scalar or categorical risk output
7. Step-up authentication
8. Configured authentication-strength policies
9. Transaction confirmation or signing

These controls are valuable. The proposed product does not replace them. It adds an explicit decision layer that preserves the suspected attack type and maps that attack to factor failure properties.

## 1.4 Why the current approach may be insufficient

A scalar score answers:

> How worried should the institution be?

A threat profile additionally answers:

> What should the institution not trust?

Two events may both produce risk `0.87`:

- Event A is driven by a recent SIM change.
- Event B is driven by phishing-relay indicators.

The appropriate challenge can differ even when the scalar risk is identical.

---

# 2. Target Users

## 2.1 Primary persona: Payment authentication product owner

### Profile

A product or engineering lead inside a bank, wallet, or payment platform who is responsible for reducing unauthorized payments without unnecessarily blocking legitimate customers.

### Daily workflow

- Reviews fraud and authentication outcomes
- Defines authentication policies
- Coordinates with fraud, identity, mobile, and compliance teams
- Monitors transaction drop-off and false challenges
- Evaluates new authentication mechanisms
- Explains control decisions to security and regulatory reviewers

### Pain points

- Risk engines and authentication orchestrators may be separate systems.
- One service may identify the threat while another blindly selects a factor.
- Authentication policies become difficult to audit as rules grow.
- Stronger authentication may increase customer failure and support demand.
- Dependencies between factors are often implicit.
- Device and channel assumptions may be hidden in implementation code.

### Jobs to be done

- Select a factor not compromised by the likely attack.
- Avoid giving the attacker a challenge through the suspected channel.
- Offer a path the customer can physically complete.
- Demonstrate that required factors are meaningfully independent.
- Explain why one factor was selected and another rejected.
- Minimize authentication delay for legitimate customers.

## 2.2 Secondary persona: Fraud operations analyst

Needs a readable decision record containing:

- Input indicators
- Threat profile
- Excluded factors
- Selection result
- Block reason
- Counterfactual conditions

The user interface should present this as **Why this factor?**, not as a raw policy dump.

## 2.3 Secondary persona: Compliance or security reviewer

Needs:

- Versioned policies
- Reproducible decisions
- Factor-property definitions
- Independence evidence
- Clear separation between probabilistic inference and deterministic enforcement

## 2.4 Secondary persona: End customer

Needs:

- Minimal friction for normal payments
- A secure alternative when a factor is unavailable
- Clear instructions when another method is required
- Protection when no safe authentication path exists

---

# 3. Existing Solutions and Competitive Landscape

## 3.1 Okta Adaptive MFA

### Strengths

- Contextual access policies
- Device posture and assurance
- Network, location, behavior, and IP signals
- Step-up authentication
- Phishing-resistant authenticators such as FIDO2/WebAuthn

### Gap relative to this concept

The public product framing emphasizes contextual risk and adaptive policy. The proposed system makes the attack hypothesis and threat-specific factor elimination the central data model.

## 3.2 Microsoft Entra Authentication Strengths

### Strengths

- Defines allowed combinations of authentication methods
- Supports phishing-resistant MFA requirements
- Supports built-in and custom authentication strengths
- Can apply stronger methods to risky or sensitive situations

### Gap relative to this concept

Authentication strengths answer:

> Which methods satisfy the required assurance?

Threat-aware selection additionally asks:

> Which otherwise valid methods should be removed because the suspected attack compromises a dependency, channel, or property?

## 3.3 Auth0 Adaptive MFA

### Strengths

- New-device assessment
- Impossible-travel assessment
- Untrusted-IP assessment
- Overall confidence score
- Custom challenge, allow, and block behavior through Actions

### Gap relative to this concept

The clearest comparison is:

```text
Conventional adaptive MFA:
signals -> overall score -> step up

Threat-aware MFA:
signals -> threat profile -> remove unsafe methods -> select valid survivor
```

## 3.4 PingOne Protect

### Strengths

- Device, network, and behavioral risk signals
- Real-time risk evaluation
- Low, Medium, and High risk levels
- Integration into authentication journeys

### Gap relative to this concept

The proposed system treats the **composition of risk** as essential to factor selection rather than using only the aggregate risk result.

## 3.5 Transmit Security Mosaic

### Strengths

- Passwordless authentication
- Adaptive MFA
- Context-aware challenges
- Passkey-based transaction signing
- Validation of signed transaction details such as amount, recipient, and currency

### Relevance

This validates the importance of retaining transaction binding. Selecting the correct factor is not enough if the challenge is not bound to the intended payment.

## 3.6 Futurae

### Strengths

- Push and scan-code transaction confirmation
- Out-of-band validation
- Dynamic linking
- Transaction logs
- Multiple authentication mechanisms
- Adaptive and fallback workflows

### Gap relative to this concept

The proposed system makes **threat-factor incompatibility**, **customer capability**, and **factor independence** explicit and explainable.

## 3.7 Open-source projects

### SimpleWebAuthn

Useful for implementing real WebAuthn with Node and browser libraries. A WebAuthn implementation requires server-side challenge persistence and user-linked credential storage.

### Keycloak Adaptive Authentication Extension

Demonstrates risk-based changes to authentication requirements and extensible evaluators. It is heavier than needed for the hackathon but useful as a reference for future identity-provider integration.

## 3.8 Competitive conclusion

The market already offers:

- Adaptive MFA
- Risk-based step-up
- Authentication-strength policies
- WebAuthn
- Transaction signing
- Factor orchestration
- Explainable reason codes

The prototype should claim innovation in how these concepts are arranged and demonstrated, not claim invention of the underlying technologies.

---

# 4. Technical Architecture Options

## Option A: Modular monolith

```text
React/Vite Frontend
        |
Express API
        |
        +-- Persona and Transaction Module
        +-- Indicator Extractor
        +-- Threat Inference Module
        +-- Factor Registry
        +-- Capability Filter
        +-- Threat Compatibility Filter
        +-- Independence Validator
        +-- Assurance and Friction Selector
        +-- Counterfactual Generator
        +-- WebAuthn/TOTP/PIN Adapters
        +-- Decision Ledger
        |
SQLite
```

### Advantages

- Fastest to build and debug
- One deployment unit
- Deterministic demo behavior
- No distributed-system failure modes
- Easy transaction handling
- Simple test coverage

### Disadvantages

- Risk and authentication modules share one process
- Not independently scalable
- Requires deliberate module boundaries

### Verdict

**Recommended for the hackathon.**

## Option B: Separate risk and authentication services

```text
Wallet UI
   |
Authentication Orchestrator
   |
   +---- Threat Inference API
   +---- Factor Adapters
   +---- Decision Ledger
```

### Advantages

- Clean split between inference and enforcement
- Easier model replacement
- Better future integration with banks or wallets
- Independent scaling

### Disadvantages

- More APIs and failure cases
- More deployment work
- More difficult debugging
- Minimal value for the prototype

### Future use

Appropriate when several payment channels consume the same threat engine.

## Option C: Event-driven platform

```text
Indicator Events
      |
Event Stream
      |
Inference Workers
      |
Policy and Selector Service
      |
Authentication Orchestrator
      |
Audit Event Store
```

### Advantages

- High-volume ingestion
- Asynchronous enrichment
- Policy replay
- Multi-channel support

### Disadvantages

- Ordering and consistency complexity
- Excessive operational overhead
- Difficult to explain in a short demo

### Verdict

Do not use for the hackathon.

---

# 5. Recommended Technology Stack

## 5.1 Frontend

### React with Vite and TypeScript

Chosen because:

- Fast development loop
- Suitable for the split-screen comparison
- Simple component model
- Easy scenario controls
- Strong visualization ecosystem

Suggested components:

- Persona selector
- Scenario controls
- Baseline panel
- Threat-aware engine panel
- Threat-profile chart
- Factor-filter pipeline
- Why this factor? panel
- Outcome display

## 5.2 Backend

### Express with TypeScript

TypeScript is recommended because the core domain contains many structured enumerations:

```text
ThreatType
FactorType
DependencyChannel
SecurityProperty
Capability
ExclusionReason
DecisionOutcome
```

Recommended modules:

```text
src/
  domain/
  inference/
  policy/
  selectors/
  factors/
  transactions/
  explanations/
  demo/
  database/
```

## 5.3 Database

### better-sqlite3

Chosen because:

- Embedded and deterministic
- No separate server
- Supports transactions
- Easy to seed and reset
- Suitable for personas, credentials, scenarios, policies, and decision records

Future production option: PostgreSQL.

## 5.4 Search systems

No search engine is required.

The prototype uses structured, small datasets. Elasticsearch, vector search, and graph databases add no meaningful value.

## 5.5 Authentication factors

### WebAuthn/passkey

Libraries:

```text
@simplewebauthn/server
@simplewebauthn/browser
```

Requirements:

- Server-side challenge storage
- User-linked credential storage
- Exact relying-party and origin configuration
- Localhost or HTTPS

### TOTP

Libraries:

```text
otplib
qrcode
```

Treat TOTP as device-held but phishable. Do not describe TOTP as universally stronger than SMS.

### PIN or knowledge factor

Use:

```text
argon2 or bcrypt
```

Requirements:

- Salted hash
- Attempt limits
- No plaintext storage
- Synthetic demo credentials only

### Simulated out-of-band confirmation

A second tab on the same machine is not a truly independent channel. Label it clearly as:

> Simulated confirmation on a separately trusted endpoint.

If possible, use a second device over HTTPS.

## 5.6 Device signals

Recommended minimal signals:

- First-party installation identifier
- User-agent category
- Screen category
- Time-zone category
- Hardware-concurrency band

Do not claim that a canvas or browser fingerprint proves hardware identity. A first-party enrollment identifier is more defensible for the prototype.

## 5.7 Hosting

### Preferred

- One presentation laptop
- Express on localhost
- React build served locally
- SQLite database
- Fixed, pre-tested browser profile

### Optional remote deployment

- HTTPS-capable deployment platform
- PostgreSQL if persistent storage is required

Local deployment is safer for a deterministic hackathon demo.

---

# 6. AI Opportunities

## 6.1 What AI or probabilistic inference should do

The intelligent component should infer a normalized threat profile from indicators.

Conceptually:

```text
Prior threat likelihood
x likelihood of observed indicators under each threat
-> normalize
-> threat profile
```

Example inputs:

```json
{
  "recentSimChange": true,
  "newDevice": true,
  "newPayee": true,
  "geoVelocityAnomaly": true,
  "screenShareIndicator": false
}
```

Example output:

```json
{
  "sim_swap": 0.62,
  "device_compromise": 0.18,
  "phishing": 0.10,
  "stolen_device": 0.05,
  "benign": 0.05
}
```

Use the phrase:

> Transparent likelihood-table inference.

Do not claim that the prototype outputs statistically calibrated real-world probabilities unless real data has been used for calibration.

## 6.2 What must remain deterministic

- Factor eligibility
- Threat-to-factor compatibility
- Capability filtering
- Independence checks
- Assurance ordering
- Friction tie-breaking
- Hard-block behavior
- WebAuthn verification
- TOTP verification
- Transaction binding
- Counterfactual generation
- Decision logging

Correct separation:

```text
Probabilistic inference:
What may be happening?

Deterministic policy:
Given that hypothesis, what authentication paths remain allowed?
```

## 6.3 Agents

No autonomous agent is required.

An agent would introduce:

- Nondeterministic decisions
- Weak auditability
- Prompt-injection risk
- Difficult testing
- No meaningful improvement to the selector

## 6.4 Counterfactuals

Counterfactuals should be generated from failed predicates.

Example:

```text
Rejected factor: SMS OTP
Failed condition: recentSimChange == false

Explanation:
SMS OTP would have been eligible if no recent SIM change had been detected.
```

This is clearer and safer than free-form LLM explanation.

---

# 7. Risks and Mitigations

## 7.1 Technical risks

### Threat profile looks arbitrary

**Risk:** Seeded likelihoods may appear invented.

**Mitigation:** Display the indicators, likelihood table, normalization, and policy version. Describe the prototype as transparent and deterministic, not trained on fraud data.

### Factor matrix is too coarse

**Risk:** A single channel tag cannot capture all failure differences.

**Mitigation:** Model dependency channels and security properties separately.

Example:

```json
{
  "id": "webauthn",
  "assurance": 4,
  "dependencyChannels": ["device"],
  "securityProperties": [
    "origin_bound",
    "phishing_resistant",
    "replay_resistant",
    "local_user_verification"
  ]
}
```

### Remote-access claim is overstated

**Risk:** A remote-control tool does not automatically satisfy biometrics.

**Mitigation:** State that remote-access indicators reduce confidence in same-device approval, not that biometrics are automatically bypassed.

### Fake out-of-band path

**Risk:** Two tabs on one device share the same environment.

**Mitigation:** Label the path as simulated or use a second trusted device.

### WebAuthn origin failure

**Risk:** WebAuthn fails because localhost, HTTPS, relying-party ID, or browser origin is misconfigured.

**Mitigation:** Test the exact presentation URL and machine. Keep a clearly disclosed simulated hardware-key fallback.

### Identical scalar risk on both screens

**Risk:** Judges may think the threat profile is preloaded decoration.

**Mitigation:** Seed indicators, not final outputs. Run the real likelihood-table calculation during the demo while preserving deterministic results.

## 7.2 Product risks

### Overclaiming originality

**Mitigation:** Do not say no one implements dynamic selection. Say the prototype makes attack-specific factor elimination explicit, explainable, and central to the architecture.

### Signal availability

**Risk:** SIM-change or remote-access indicators may not be available to every developer or institution.

**Mitigation:** Clearly label external indicators as seeded. Explain that production systems would consume carrier, fraud, device, or endpoint-security feeds.

### False hard blocks

**Risk:** Incorrect threat inference can remove valid factors.

**Mitigation:** Add uncertainty thresholds, a safe fallback policy, and post-hackathon assisted recovery.

## 7.3 Security risks

- Keep WebAuthn challenges server-side.
- Use one-time, expiring challenges.
- Rate-limit TOTP and PIN attempts.
- Never log OTP, PIN, or private credential material.
- Store public WebAuthn credential data only.
- Encrypt TOTP secrets in production.
- Version factor matrices and policies.
- Bind authentication to transaction ID, amount, recipient, version, expiry, and nonce.
- Isolate demo controls from the customer-facing application.

## 7.4 Scalability risks

The prototype does not solve:

- Multi-region consistency
- Large-scale event ingestion
- Carrier API availability
- Production model calibration
- High-availability authentication
- Large policy rollouts
- Account recovery at scale
- Resilient audit storage

These are roadmap concerns, not MVP requirements.

---

# 8. MVP Scope

## 8.1 Must build

### Three seeded personas

#### Priya

- High-value payment
- New payee
- Recent SIM change
- New device
- Location anomaly

#### Ravi

- High-value payment
- Trusted device
- Remote-access or device-compromise indicator

#### Lakshmi

- Feature-phone or constrained-device profile
- No passkey
- Fingerprint route unavailable
- Normal amount
- Known payee

### Threat inference function

Input indicators must be processed into the threat profile. Do not store only the completed profile.

### Factor registry

Each factor should include:

```json
{
  "id": "webauthn",
  "assurance": 4,
  "dependencyChannels": ["device"],
  "securityProperties": [
    "origin_bound",
    "phishing_resistant",
    "replay_resistant"
  ],
  "expectedSeconds": 6,
  "availabilityRequirements": ["passkey_enrolled"]
}
```

### Selector pipeline

1. Infer threat profile.
2. Remove factors compromised by the likely threat.
3. Remove factors the user cannot complete.
4. Build valid independent factor combinations.
5. Select the highest-assurance valid option.
6. Break assurance ties using expected friction.
7. Hard block when no valid option survives.
8. Generate explanations and counterfactuals.

### Baseline engine

Suggested baseline:

```text
Low risk -> PIN
Medium risk -> OTP
High risk -> biometric + OTP
```

Label this as a simplified risk-ladder baseline, not as a claim about all banks.

### Why this factor? panel

Display:

- Selected factor
- Excluded factors
- Reason for each exclusion
- Counterfactual for each rejected factor
- Final decision

### Real WebAuthn if stable

WebAuthn is the credibility anchor. Use a simulation fallback only if necessary and disclose that honestly.

### Transaction binding

Bind every selected authentication challenge to:

- Transaction ID
- Amount
- Recipient
- Transaction version
- Expiry
- Nonce

## 8.2 Postpone

- Live carrier SIM-swap integration
- Real endpoint-security integration
- Production geolocation
- Trained fraud model
- Continuous authentication
- Policy-administration UI
- Multi-tenancy
- Real bank integration
- Fraud case management
- Full account recovery
- Production device attestation
- Feature-phone telecom integration

## 8.3 Never attempt in the MVP

- Keystroke biometrics from a short PIN
- Autonomous LLM authentication decisions
- Raw biometric storage
- Real-money transfer
- Blockchain
- Microservices
- Kafka
- Vector search
- Claims that seeded scores are real fraud probabilities
- Claims that remote access automatically defeats biometrics
- Claims that no competitor has dynamic factor selection

---

# 9. Demo Strategy Under Three Minutes

## Act 1: Victim first

> Priya's mobile number was SIM-swapped. She is about to lose Rs. 80,000, and a conventional risk ladder is about to send the challenge through the compromised channel.

Show the split screen with identical inputs and identical scalar risk.

### Baseline

```text
Risk: 0.87
High risk
-> stronger challenge
-> SMS OTP
-> approved
```

Show the transfer outcome.

## Act 2: Same transaction, different intelligence

Show the same indicators:

```text
Recent SIM change
New device
New payee
Location anomaly
```

Display the threat profile:

```text
SIM swap          0.62
Device compromise 0.18
Phishing          0.10
Stolen device     0.05
Benign            0.05
```

Animate the filter:

```text
SMS OTP
-> excluded
-> recent SIM change

Passkey
-> enrolled
-> origin-bound
-> phishing-resistant
-> survives

Selected:
Passkey
```

The attacker cannot complete the passkey challenge, so the payment is blocked.

## Act 3: Inclusion

Show Lakshmi:

```text
Constrained device
No passkey
Fingerprint method unavailable
Known payee
Normal amount
Benign threat profile
```

The system removes unusable factors and uses the lowest-friction valid path.

## Closing line

> Risk tells you how worried to be. A threat profile tells you what not to trust. The strongest factor and the appropriate factor are not the same thing.

---

# 10. Development Roadmap

## Phase 1: Domain model and invariants

Define:

- Threats
- Indicators
- Factors
- Dependency channels
- Security properties
- User capabilities
- Assurance levels
- Outcomes
- Exclusion reasons
- Counterfactual rules

## Phase 2: Deterministic scenario kernel

Implement:

- Persona fixtures
- Indicator extraction
- Likelihood-table inference
- Threat-compatibility filtering
- Capability filtering
- Independence validation
- Assurance and friction selection
- Decision record
- Counterfactual generation

The kernel should accept JSON and return JSON without any UI dependency.

## Phase 3: Authentication adapters

Common adapter interface:

```ts
interface AuthenticationFactor {
  enroll(userId: string): Promise<EnrollmentResult>;
  challenge(context: ChallengeContext): Promise<ChallengeResult>;
  verify(input: VerificationInput): Promise<VerificationResult>;
  availability(user: UserContext): AvailabilityResult;
}
```

Adapters:

- WebAuthn
- TOTP
- PIN
- Simulated independent endpoint

## Phase 4: Transaction binding

Bind challenge creation and verification to the current transaction version and protected payment details.

## Phase 5: Baseline comparison

Run identical inputs through:

- Scalar risk-ladder baseline
- Threat-aware selector

Store both decisions for side-by-side presentation.

## Phase 6: Presentation UI

Build:

- Persona selector
- Split-screen comparison
- Threat-profile chart
- Factor-exclusion animation
- Why this factor? panel
- Counterfactual explanations
- Customer outcome
- Regulatory-principle card

## Phase 7: Validation

Required invariants:

- A compromised factor cannot be selected.
- An unavailable factor cannot be selected.
- Invalid dependencies cannot satisfy independence.
- Friction matters only after assurance requirements are met.
- Empty survivor set always blocks.
- Transaction edits invalidate the challenge.
- Consumed challenges cannot be replayed.
- Identical inputs produce identical outputs.

---

# Suggested Data Model

## Persona

```text
id
name
device_capabilities
factor_enrollments
normal_transaction_profile
network_profile
```

## Transaction

```text
id
persona_id
amount_minor
currency
payee_id
payee_is_known
version
status
created_at
```

## Indicator Set

```text
id
transaction_id
recent_sim_change
new_device
geo_velocity_anomaly
screen_share_indicator
stolen_device_indicator
network_quality
created_at
```

## Factor Definition

```text
id
name
assurance
dependency_channels
security_properties
expected_seconds
availability_requirements
```

## Threat Profile

```text
id
transaction_id
sim_swap
phishing
device_compromise
stolen_device
benign
inference_version
```

## Decision Record

```text
id
transaction_id
selected_factor_or_pair
excluded_factors
exclusion_reasons
counterfactuals
outcome
policy_version
created_at
```

## Challenge

```text
id
transaction_id
transaction_version
factor_id
nonce_hash
expires_at
consumed_at
status
```

---

# Selector Pseudocode

```ts
function selectAuthenticationPath(input: SelectionInput): Decision {
  const threatProfile = inferThreatProfile(input.indicators);

  const threatCompatible = input.factors.filter((factor) =>
    isCompatibleWithThreats(factor, threatProfile, input.policy)
  );

  const userCapable = threatCompatible.filter((factor) =>
    canUserComplete(factor, input.userCapabilities)
  );

  const validOptions = buildIndependentOptions(
    userCapable,
    input.policy.requiredFactorCount,
    input.policy.independenceRules
  );

  const qualified = validOptions.filter((option) =>
    option.assurance >= input.policy.requiredAssurance
  );

  if (qualified.length === 0) {
    return buildBlockDecision(input, threatProfile);
  }

  qualified.sort((a, b) => {
    if (a.assurance !== b.assurance) {
      return b.assurance - a.assurance;
    }
    return a.expectedSeconds - b.expectedSeconds;
  });

  return buildApprovalDecision(
    qualified[0],
    input,
    threatProfile
  );
}
```

---

# Testing Strategy

## Unit tests

- Threat inference normalization
- Threat-to-factor compatibility
- Capability filtering
- Independence validation
- Assurance ordering
- Friction tie-breaking
- Counterfactual generation
- Empty-result blocking

## Scenario tests

### Priya

Expected:

- SMS OTP excluded
- Passkey selected if enrolled
- Transaction blocked if attacker cannot complete passkey

### Ravi

Expected:

- Same-device methods treated according to dependency and security properties
- Separately trusted confirmation preferred when policy requires independence

### Lakshmi

Expected:

- Unavailable passkey removed
- Unavailable fingerprint route removed
- Normal transaction receives a valid low-friction path

## Security tests

- WebAuthn challenge cannot be reused
- Expired challenge fails
- Transaction edit invalidates challenge
- TOTP attempts are rate-limited
- PIN is never stored in plaintext
- Demo controls cannot invoke customer endpoints without authorization

## Acceptance criteria

- Both engines receive identical scenario inputs.
- Threat profile is calculated from indicators.
- Selection result is deterministic.
- Every rejected factor has a reason.
- Every rejected factor has a counterfactual.
- WebAuthn works on the exact demo origin or the UI clearly labels the fallback simulation.
- All three scenarios run without external APIs.

---

# Source References

1. Reserve Bank of India, *Authentication Mechanisms for Digital Payment Transactions Directions, 2025*  
   <https://www.rbi.org.in/Scripts/NotificationUser.aspx?Id=12898>

2. KPMG India, *RBI Authentication Mechanisms for Digital Payment Transactions Directions, 2025*  
   <https://kpmg.com/in/en/insights/2025/12/reserve-bank-of-india-rbi-authentication-mechanisms-for-digital-payment-transactions-directions-2025.html>

3. W3C, *Web Authentication: An API for Accessing Public Key Credentials - Level 2*  
   <https://www.w3.org/TR/webauthn-2/>

4. SimpleWebAuthn Documentation  
   <https://simplewebauthn.dev/>

5. CAMARA Project, *SIM Swap API*  
   <https://camaraproject.org/sim-swap/>

6. GSMA Open Gateway, *SIM Swap API Documentation*  
   <https://open-gateway.gsma.com/docs/sim-swap>

7. Okta, *Adaptive Multi-Factor Authentication*  
   <https://www.okta.com/products/adaptive-multi-factor-authentication/>

8. Microsoft Learn, *Conditional Access Authentication Strengths*  
   <https://learn.microsoft.com/en-us/entra/identity/authentication/concept-authentication-strengths>

9. Auth0, *Adaptive MFA*  
   <https://auth0.com/docs/secure/multi-factor-authentication/adaptive-mfa>

10. Ping Identity, *PingOne Protect Risk-Based Authentication*  
    <https://docs.pingidentity.com/pingoneaic/integrations/pingone-protect.html>

11. Transmit Security, *Transaction Signing with Passkeys*  
    <https://developer.transmitsecurity.com/guides/orchestration/journeys/transaction_signing_webauthn>

12. Futurae, *Secure Transaction Confirmation and Signing*  
    <https://www.futurae.com/transaction-signing/>

13. Keycloak Adaptive Authentication Extension  
    <https://github.com/mabartos/keycloak-adaptive-authn>

---

# Final Product Positioning

> **Threat-Aware Intelligent MFA is an authentication orchestrator for digital payments. Instead of escalating to the strongest available factor, the engine identifies the likely attack, eliminates factors compromised by that attack, removes factors the customer cannot complete, verifies factor independence, and selects the lowest-friction path that still satisfies the required assurance. Every decision explains why the chosen factor survived and what would have made each rejected factor eligible.**

## Final tagline

> **The strongest factor and the appropriate factor are not the same thing.**
