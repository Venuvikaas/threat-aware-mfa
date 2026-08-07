/**
 * Deterministic mock signal providers (docs/EXECUTION.md Phase 4).
 *
 * The mock telecom adapter reports recent SIM change; the mock geo adapter
 * reports login-location distance. They return conservative defaults — the
 * demo overrides (demo mode only) supply the hero scenario values, and a
 * provider that throws yields an explicit unknown signal, never fabricated
 * safe data.
 */
import type { ProviderContext, SignalProvider, SignalValue } from "./signalProvider.js";

export class MockTelcoProvider implements SignalProvider {
  readonly name = "mock_telco_adapter";
  readonly signalName = "recent_sim_change";

  getSignals(_ctx: ProviderContext): SignalValue[] {
    return [
      {
        name: this.signalName,
        value: false,
        source: this.name,
        synthetic: true,
        observedAt: "",
      },
    ];
  }
}

export class MockGeoProvider implements SignalProvider {
  readonly name = "mock_geo_adapter";
  readonly signalName = "geo_distance_from_last_login_km";

  getSignals(_ctx: ProviderContext): SignalValue[] {
    return [
      {
        name: this.signalName,
        value: null,
        source: this.name,
        synthetic: true,
        observedAt: "",
      },
    ];
  }
}

export const DEFAULT_SIGNAL_PROVIDERS: SignalProvider[] = [
  new MockTelcoProvider(),
  new MockGeoProvider(),
];

export interface NormalizedSignals {
  /** Signal records to persist (provenance intact). */
  list: SignalValue[];
  /** Values consumed by the engines. */
  recentSimChange: boolean | null;
  geoDistanceFromLastLoginKm: number | null;
  phishingRelayIndicator: boolean;
}

export interface SignalOverride {
  recentSimChange: boolean | null;
  geoDistanceFromLastLoginKm: number | null;
}

/**
 * Collect provider signals, apply demo overrides, tag timestamps, and append
 * the client-supplied phishing indicator + device profile signal. Provider
 * failure becomes an explicit unknown signal with an unavailable source.
 */
export function collectSignals(
  providers: SignalProvider[],
  ctx: ProviderContext,
  demoMode: boolean,
  overrides: SignalOverride,
  phishingRelayIndicator: boolean,
  firstSeen: boolean,
  observedAt: string
): NormalizedSignals {
  const merged = new Map<string, SignalValue>();

  for (const provider of providers) {
    let values: SignalValue[];
    try {
      values = provider.getSignals(ctx);
    } catch {
      values = [
        {
          name: provider.signalName,
          value: null,
          source: `${provider.name}_unavailable`,
          synthetic: true,
          observedAt,
        },
      ];
    }
    for (const v of values) {
      if (demoMode) {
        const override = overrideFor(v.name, overrides);
        if (override !== undefined) {
          merged.set(v.name, {
            name: v.name,
            value: override,
            source: "demo_override",
            synthetic: true,
            observedAt,
          });
          continue;
        }
      }
      merged.set(v.name, { ...v, observedAt });
    }
  }

  merged.set("phishing_relay_indicator", {
    name: "phishing_relay_indicator",
    value: phishingRelayIndicator,
    source: "client_signal",
    synthetic: true,
    observedAt,
  });
  merged.set("first_seen_device", {
    name: "first_seen_device",
    value: firstSeen,
    source: "device_profile",
    synthetic: true,
    observedAt,
  });

  const list = [...merged.values()];
  return {
    list,
    recentSimChange:
      (merged.get("recent_sim_change")?.value as boolean | null) ?? null,
    geoDistanceFromLastLoginKm:
      (merged.get("geo_distance_from_last_login_km")?.value as number | null) ??
      null,
    phishingRelayIndicator,
  };
}

function overrideFor(
  name: string,
  overrides: SignalOverride
): boolean | number | null | undefined {
  switch (name) {
    case "recent_sim_change":
      return overrides.recentSimChange;
    case "geo_distance_from_last_login_km":
      return overrides.geoDistanceFromLastLoginKm;
    default:
      return undefined;
  }
}
