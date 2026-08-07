# Threat-Aware MFA Policy Simulator

**Risk tells you how worried to be. Threat context tells you what not to trust.**

A frontend-only, deterministic policy-decision simulator for a hackathon. It
shows that two payments with the **same aggregate risk** can require
**different authentication decisions** when different channels are under
suspicion.

## Problem

A payment can be correctly classified as high risk while still receiving an
inappropriate authentication challenge. If the risk is driven by a recent SIM
change, sending an SMS OTP routes the challenge through the channel under
suspicion. A scalar score describes severity but loses the reason behind it.

## What the simulator demonstrates

Two seeded, high-risk payments side by side:

| | Scenario A | Scenario B |
|---|---|---|
| Aggregate risk | High | High |
| Required assurance | 2+ | 2+ |
| Threat indicator | Recent SIM change | Phishing relay indicator |
| Suspected hypothesis | SIM channel compromise | Phishing relay |
| What is distrusted | Phone number (SMS channel) | SMS relay path (one-time code delivery) |
| SMS OTP | Excluded — `SMS_CHANNEL_UNTRUSTED` | Excluded — `FACTOR_RELAYABLE` |
| Passkey (enrolled) | Selected | Selected |

Every panel shows a five-stage decision trace:

1. **Observed** — the synthetic indicators supplied to the engine
2. **Suspected** — the deterministic threat hypothesis and support band
3. **Do not trust** — the channel or property placed under suspicion
4. **Excluded** — each removed factor with a stable reason code
5. **Decision** — the selected factor or assisted recovery

A **fair scalar baseline** shows what a severity-only policy can conclude:
for both scenarios it returns the same requirement (`phishing-resistant factor
required`) because it receives only risk and assurance — never the threat
indicators.

Turn off passkey enrollment and the engine chooses **assisted recovery**
instead of falling back to the excluded SMS channel.

## Explicit non-goals

- Not a fraud detector, identity provider, authentication platform, or
  payment system.
- No real WebAuthn, TOTP, PIN, or factor execution — outcomes are simulated
  and labeled as such.
- No backend, database, external threat-signal APIs, LLM, or trained AI.
- No calibrated probabilities — only support bands (`high_support`,
  `moderate_support`, `insufficient_evidence`).
- No policy editor; the policy is a committed, versioned fixture.

## Prerequisites

- Node.js 18+ and npm

## Install and run

```bash
npm install
npm run dev
```

Open http://localhost:5173.

## Test

```bash
npm run check
```

Runs TypeScript validation, unit and scenario tests, and a production build.
Exit code is non-zero on any failure.

## Demo scenarios

- `src/scenarios/simSwap.ts` — recent SIM change, new device, new payee
- `src/scenarios/phishing.ts` — phishing relay, unusual session, new payee

Both share the same aggregate risk, required assurance, amount, and payee
sensitivity; only the threat composition differs.

## Architecture

```
React/Vite UI
   |
   +-- Scenario fixtures (src/scenarios)      seeded input only
   +-- Static policy fixture (src/policy)     versioned rules + approved copy
   +-- Pure decision engine (src/engine)      Scenario + Policy -> Decision
          classifyThreat -> evaluateFactors -> selectOutcome
   +-- Components (src/components)            render Decision, no policy logic
```

The engine is a pure function with no React, storage, network, clock, random,
or browser dependency. Identical inputs always produce deeply equal outputs.

## Claim limitations

- The scenario supplies synthetic indicators; the product does not detect SIM
  swaps or phishing attacks.
- The engine applies a deterministic demonstration policy; support bands are
  not calibrated probabilities.
- The prototype selects a policy outcome; it does not execute authentication.
- Passkeys are not claimed to defeat every device-compromise scenario.

## Demo evidence

- [ ] Screenshot: default comparison view (add before submission)
- [ ] Recording link: 2–3 minute walkthrough (add before submission)

See `docs/demo-script.md` for the exact judged sequence.
