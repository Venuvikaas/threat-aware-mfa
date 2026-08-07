# Demo Script — Threat-Aware MFA Decision Service

Target: **2–3 minutes**. One screen, hero presets, live backend, no editing.

## Setup before judging

```bash
npm run check    # typecheck + tests + build must pass
npm run smoke    # end-to-end demo path: SMOKE: PASS on a fresh database
npm run dev      # API on :4000, client on http://localhost:5173
```

Confirm the header shows **API online**, the two hero cards (**SIM swap**,
**Phishing relay**) are visible, and the customer is **Aarav Nair (passkey
enrolled)**.

## The sequence

### 1. Ask the opening question

> "These two payments have the same risk score. Should they receive the same
> authentication challenge?"

Do not open with architecture or AI.

### 2. Run the SIM-swap scenario

Click **SIM swap**. Call out, pointing at the request flow:

> "The client submits a ₹50,000 transaction through `POST /api/v1/decisions`.
> The backend evaluates risk, threat, and factor eligibility."

Point to the result:

- RISK **HIGH** with its exact reason chips (`recent_sim_change`,
  `first_seen_device`, …)
- Suspected threat **SIM channel compromise**
- Factor cards: **PASSKEY ALLOWED**, **SMS OTP BLOCKED** — reason code
  `sms_channel_untrusted`

> "The high-risk score says 'authenticate more'. The threat context says
> something stronger: don't send an OTP through the channel under suspicion."

### 3. Show persistence

Open the **audit timeline**: `DECISION_CREATED → FACTOR_BLOCKED → FACTOR_SELECTED`,
each with its reason and policy version. Click **Show raw API response** to
show the exact machine-readable decision and copy it.

### 4. Run the phishing scenario

Click **Phishing relay**. The **SAME RISK** banner appears — same risk level,
same scalar baseline requirement — but the second panel shows **Phishing
relay** and SMS OTP blocked for a different reason: `factor_relayable`.

> "Same risk, same baseline, different distrust."

### 5. The wow moment — direct API enforcement

On the SIM-swap panel click **Try SMS_OTP (blocked)**. The client calls
`POST /api/v1/challenges` with the blocked factor and the backend answers:

> **POLICY_REJECTION — blocked by persisted policy**

> "You cannot bypass the decision by calling the API directly. The persisted
> policy decision is enforced at the challenge boundary."

### 6. Execute the selected factor

Click **Continue with PASSKEY** → **Verify with simulated passkey**. Show the
SIMULATED label, then the transaction **AUTHORIZED** and the new
`CHALLENGE_CREATED → CHALLENGE_VERIFIED` audit events.

### 7. The conservative fallback

Switch the customer to **Priya Sharma (no passkey)** in the form and click
**Evaluate transaction**. The backend returns **Assisted recovery required** —
no factor survives, and the service never falls back to the untrusted SMS
channel.

### 8. Reset

Click **Reset demo**; the database returns to its deterministic seed and the
panels clear. Refresh the page — everything reloads from the backend.

## Closing

> "This is not a static risk dashboard. It is an integration-ready decision
> service: signals enter through an API, policy is enforced on the server,
> factor challenges cannot bypass the decision, and every result is auditable."

## Claim boundaries to respect

- All signals are **synthetic demo data** from mock provider adapters.
- The passkey path is a **labeled simulated adapter**, not real WebAuthn.
- Support bands are deterministic policy output, not calibrated probabilities.
- No live carrier, bank, UPI, or telecom integration exists.
