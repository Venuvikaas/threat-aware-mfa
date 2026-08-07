/**
 * Signal provider boundary tests (docs/EXECUTION.md Phase 4 exit gate):
 * provenance on every signal, demo overrides only in demo mode, and provider
 * failure producing an explicit unknown signal — never fabricated safe data.
 */
import { describe, expect, it } from "vitest";
import {
  collectSignals,
  MockGeoProvider,
  MockTelcoProvider,
} from "../src/providers/mockSignalProvider.js";
import type { SignalProvider } from "../src/providers/signalProvider.js";

const ctx = { userId: "user_demo_01", deviceId: "dev_new_01" };
const now = "2026-08-07T12:00:00.000Z";

describe("collectSignals", () => {
  it("tags every signal with provenance and server time", () => {
    const result = collectSignals(
      [new MockTelcoProvider(), new MockGeoProvider()],
      ctx,
      false,
      { recentSimChange: null, geoDistanceFromLastLoginKm: null },
      false,
      false,
      now
    );
    expect(result.list.length).toBe(4); // sim, geo, phishing, first_seen_device
    const sim = result.list.find((s) => s.name === "recent_sim_change");
    expect(sim).toMatchObject({
      value: false,
      source: "mock_telco_adapter",
      synthetic: true,
      observedAt: now,
    });
    const geo = result.list.find((s) => s.name === "geo_distance_from_last_login_km");
    expect(geo?.source).toBe("mock_geo_adapter");
  });

  it("applies demo overrides only in demo mode", () => {
    const providers = [new MockTelcoProvider(), new MockGeoProvider()];

    const demo = collectSignals(
      providers,
      ctx,
      true,
      { recentSimChange: true, geoDistanceFromLastLoginKm: 420.5 },
      false,
      true,
      now
    );
    expect(demo.recentSimChange).toBe(true);
    expect(demo.geoDistanceFromLastLoginKm).toBe(420.5);
    expect(
      demo.list.find((s) => s.name === "recent_sim_change")?.source
    ).toBe("demo_override");

    // Outside demo mode the override is ignored; the mock default stands.
    const production = collectSignals(
      providers,
      ctx,
      false,
      { recentSimChange: true, geoDistanceFromLastLoginKm: 420.5 },
      false,
      true,
      now
    );
    expect(production.recentSimChange).toBe(false);
    expect(production.geoDistanceFromLastLoginKm).toBeNull();
    expect(
      production.list.find((s) => s.name === "recent_sim_change")?.source
    ).toBe("mock_telco_adapter");
  });

  it("turns a provider failure into an explicit unknown signal", () => {
    const broken: SignalProvider = {
      name: "broken_telco",
      signalName: "recent_sim_change",
      getSignals() {
        throw new Error("provider unreachable");
      },
    };
    const result = collectSignals(
      [broken, new MockGeoProvider()],
      ctx,
      false,
      { recentSimChange: null, geoDistanceFromLastLoginKm: null },
      false,
      false,
      now
    );
    expect(result.recentSimChange).toBeNull();
    const sim = result.list.find((s) => s.name === "recent_sim_change");
    expect(sim).toMatchObject({
      value: null,
      source: "broken_telco_unavailable",
      synthetic: true,
    });
  });
});
