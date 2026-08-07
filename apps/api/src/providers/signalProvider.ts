/**
 * Signal provider boundary (docs/EXECUTION.md Phase 4).
 *
 * A provider simulates an upstream contract (telco, device risk, geo/IP
 * reputation). Every provider result carries explicit provenance: name,
 * value, source, observed time, and `synthetic: true`. The API never claims
 * these are live integrations.
 */
export interface SignalValue {
  name: string;
  value: boolean | number | null;
  source: string;
  observedAt: string;
  synthetic: boolean;
}

export interface ProviderContext {
  userId: string;
  deviceId: string;
}

export interface SignalProvider {
  /** Stable provider identity, e.g. "mock_telco_adapter". */
  readonly name: string;
  /** The single signal name this provider owns. */
  readonly signalName: string;
  getSignals(ctx: ProviderContext): SignalValue[];
}
