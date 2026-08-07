# Signal Provider Seams — where real adapters would connect

The service evaluates decisions from signals delivered through a provider
boundary (`apps/api/src/providers/signalProvider.ts`). Today every provider is
a deterministic mock that returns conservative defaults and tags every result
`synthetic: true`. This document describes the real-world seam each mock
represents. **None of these integrations exist in this prototype.**

| Mock provider | Signal | Real production seam |
|---|---|---|
| `mock_telco_adapter` | `recent_sim_change` | Carrier/Telco API — SIM swap status for the phone number linked to the account |
| `mock_geo_adapter` | `geo_distance_from_last_login_km` | IP-reputation / geo-location service, or a fraud-risk API combining login location history |
| device profile (request) | `first_seen_device`, trusted state | Device-risk vendor or an internal device registry (the prototype persists first/last seen itself) |
| client signal (request) | `phishing_relay_indicator` | Client SDK / content-detection pipeline emitting a phishing-relay signal |
| — | payee risk | UPI / Account Aggregator or internal payee-intelligence service (payee fields are request-supplied today) |

## How a real adapter would plug in

Implement `SignalProvider` (name, signalName, `getSignals(ctx)`) and add it to
the provider list passed to the decision service. The engines, persistence,
audit trail, and policy enforcement do not change — they consume normalized
signals regardless of source.

```ts
import type { SignalProvider } from "./signalProvider.js";

export class CarrierSimSwapProvider implements SignalProvider {
  readonly name = "carrier_apigw_v1";
  readonly signalName = "recent_sim_change";
  getSignals(ctx) {
    // Real carrier lookup. On timeout or 5xx, THROW — the decision service
    // converts a provider failure into an explicit unknown signal
    // (source: `${name}_unavailable`), never fabricated safe data.
  }
}
```

## Non-negotiable rules

- A failing provider yields an **unknown signal**, never a fabricated safe value.
- Every signal is persisted with source, observed time, and `synthetic` flag.
- In demo mode only, explicit request signals may override mock provider
  values (tagged `demo_override`). Outside demo mode, overrides are ignored.
- No OTP, credential, passkey private key, or biometric data is ever stored.
