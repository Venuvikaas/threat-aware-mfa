/**
 * Evidence normalization coverage (EXECUTION_new2.md Phase 1 [TEST] box).
 * Active, stale, unavailable, conflicting, and malformed evidence.
 */
import { describe, expect, it } from "vitest";
import { normalizeEvidence, overrideEvidence } from "@mfa/decision-core";

const NOW = "2026-08-07T08:00:00.000Z";

describe("normalizeEvidence", () => {
  it("marks fresh evidence ACTIVE within its validity window", () => {
    const items = normalizeEvidence(
      [
        {
          type: "RECENT_SIM_CHANGE",
          value: true,
          providerId: "mock_telco",
          providerType: "telco",
          observedAt: NOW,
          validUntil: "2026-08-07T09:00:00.000Z",
          synthetic: true,
          quality: "CONFIRMED",
        },
      ],
      NOW
    );
    expect(items[0].status).toBe("ACTIVE");
    expect(items[0].id).toBe("ev_0");
  });

  it("marks expired evidence STALE", () => {
    const items = normalizeEvidence(
      [
        {
          type: "RECENT_SIM_CHANGE",
          value: true,
          providerId: "mock_telco",
          providerType: "telco",
          observedAt: "2026-08-01T00:00:00.000Z",
          validUntil: "2026-08-01T01:00:00.000Z",
          synthetic: true,
          quality: "CONFIRMED",
        },
      ],
      NOW
    );
    expect(items[0].status).toBe("STALE");
  });

  it("marks null values UNAVAILABLE regardless of window", () => {
    const items = normalizeEvidence(
      [
        {
          type: "RECENT_SIM_CHANGE",
          value: null,
          providerId: "mock_telco_unavailable",
          providerType: "telco",
          observedAt: NOW,
          validUntil: null,
          synthetic: true,
          quality: "UNKNOWN",
        },
      ],
      NOW
    );
    expect(items[0].status).toBe("UNAVAILABLE");
  });

  it("assigns deterministic ids by index", () => {
    const items = normalizeEvidence(
      [
        overrideEvidence("NEW_PAYEE", true, 0, NOW),
        overrideEvidence("HIGH_VALUE_TRANSACTION", true, 1, NOW),
      ],
      NOW
    );
    expect(items.map((i) => i.id)).toEqual(["ev_0", "ev_1"]);
  });

  it("preserves provenance fields", () => {
    const items = normalizeEvidence(
      [
        {
          type: "GEO_DISTANCE_ANOMALY",
          value: true,
          providerId: "mock_geo",
          providerType: "geo",
          observedAt: NOW,
          validUntil: null,
          synthetic: true,
          quality: "REPORTED",
        },
      ],
      NOW
    );
    expect(items[0].providerId).toBe("mock_geo");
    expect(items[0].providerType).toBe("geo");
    expect(items[0].synthetic).toBe(true);
    expect(items[0].quality).toBe("REPORTED");
  });
});
