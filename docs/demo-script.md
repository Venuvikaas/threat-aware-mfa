# Demo Script — Threat-Aware MFA Policy Simulator

Target: **2–3 minutes**. One screen, preset controls only, no network.

## Setup before judging

```bash
npm run check   # verify the smoke gate passes
npm run dev     # start the app, open http://localhost:5173
```

Confirm the default view shows both scenarios with passkey enrolled and the
blue **SAME RISK** badge visible.

## The sequence

### 1. Ask the opening question

> "These two payments have the same risk score. Should they receive the same
> authentication challenge?"

Do not open with architecture or AI.

### 2. Point to the shared high-risk score

Point to the **SAME RISK** badge and the identical risk, assurance, amount,
and payee values in the header. Stress: every scalar input is identical.

### 3. Reveal the differing threat evidence

Left panel: **Recent SIM change** (tagged "drives hypothesis"), new device,
new payee.
Right panel: **Phishing relay indicator** (tagged "drives hypothesis"),
unusual session, new payee.

> "Same risk — but the suspected failure path differs."

### 4. Show the scalar baseline

Point to the dashed baseline card: both scenarios return
`phishing-resistant factor required` because the baseline sees only risk and
assurance.

> "A severity-only policy cannot distinguish these two events."

### 5. Follow both five-stage traces

Stage by stage: Observed → Suspected → Do not trust → Excluded → Decision.
Left: SIM channel compromise, distrusts the phone number. Right: phishing
relay, distrusts the SMS relay path.

### 6. Explain why SMS is excluded for different reasons

Left: `SMS_CHANNEL_UNTRUSTED` — the code routes through the suspected phone
number.
Right: `FACTOR_RELAYABLE` — the code can be relayed to the attacker.

> "Same factor, same outcome — but different, defensible reasons."

### 7. Toggle passkey enrollment off

On the SIM-swap panel, turn off **Passkey enrolled**.

### 8. Show assisted recovery instead of unsafe fallback

The passkey becomes `unavailable`, SMS stays `excluded`, and the outcome
becomes:

> "Payment paused. Continue through assisted recovery."

> "The policy does not pick an unsafe method just to complete the flow."

### 9. Close with the tagline and product boundary

> "Risk tells you how worried to be. Threat context tells you what not to
> trust."

Then state the boundary:

> "This prototype does not detect fraud or replace an identity provider. It
> is the decision layer that turns existing threat evidence into an
> explainable factor policy. The scenario supplies synthetic indicators, and
> authentication execution is simulated."

## After the demo

Click **Reset demo** to restore the default view, or refresh the page — the
deterministic default state returns either way.
