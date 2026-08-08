/**
 * Threat-Aware MFA Decision Service — client (EXECUTION_new2.md Phase 5/9).
 *
 * The client submits transactions to the backend and renders what the API
 * returns. No decision logic lives here: risk, threat, trust, factor
 * eligibility, selection, and the trace are all computed by the API.
 */
import { useEffect, useMemo, useState } from "react";
import type { CreateDecisionRequest } from "@mfa/contracts";
import { DEMO_USERS } from "@mfa/demo-data";
import { api, ApiError } from "./lib/api";
import { DEMO_PRESETS } from "./lib/presets";
import type { DecisionRecord, FormState, SlotKey } from "./types";
import { DecisionPanel } from "./components/DecisionPanel";
import { PasskeyPanel } from "./components/PasskeyPanel";
import { TransactionForm } from "./components/TransactionForm";

const DEFAULT_FORM: FormState = {
  userId: "user_demo_01",
  amountRupees: 50000,
  payeeIsKnown: false,
  deviceId: "dev_new_01",
  sessionId: "sess_unusual_01",
  ageSeconds: 120,
  failedLoginCount: 2,
  ipAddress: "198.51.100.44",
  asn: "AS16509",
  country: "US",
  recentSimChange: "true",
  phishingRelay: false,
  geoDistanceKm: "unknown",
};

export function App() {
  const [health, setHealth] = useState<string>("checking");
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [slots, setSlots] = useState<{
    left: DecisionRecord | null;
    right: DecisionRecord | null;
  }>({ left: null, right: null });
  const [submitting, setSubmitting] = useState(false);
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [busyHero, setBusyHero] = useState<string | null>(null);

  useEffect(() => {
    api
      .health()
      .then((h) => setHealth(h.database === "ok" ? "online" : "degraded"))
      .catch(() => setHealth("offline"));
  }, []);

  async function evaluate(req: CreateDecisionRequest, slot: SlotKey) {
    setBannerError(null);
    setSubmitting(true);
    try {
      const decision = await api.createDecision(req);
      setSlots((s) => ({
        ...s,
        [slot]: { decision, createdAt: new Date().toISOString() },
      }));
    } catch (err) {
      const message =
        err instanceof ApiError
          ? `${err.code}: ${err.message}`
          : "Request failed — is the API running?";
      setBannerError(message);
    } finally {
      setSubmitting(false);
    }
  }

  function formToRequest(clientTransactionId: string): CreateDecisionRequest {
    return {
      userId: form.userId,
      clientTransactionId,
      transaction: {
        amountMinor: Math.round(form.amountRupees * 100),
        currency: "INR",
        payeeId: form.payeeIsKnown ? "payee_known_01" : `payee_${Date.now()}`,
        payeeIsKnown: form.payeeIsKnown,
      },
      session: {
        sessionId: form.sessionId,
        deviceId: form.deviceId,
        ageSeconds: form.ageSeconds,
        failedLoginCount: form.failedLoginCount,
        ipAddress: form.ipAddress,
        asn: form.asn,
        country: form.country,
      },
      evidenceOverrides: [
        { type: "RECENT_SIM_CHANGE", value: form.recentSimChange === "true" },
        { type: "PHISHING_RELAY_INDICATOR", value: form.phishingRelay },
        ...(form.recentSimChange === "true"
          ? [{ type: "FIRST_SEEN_DEVICE" as const, value: true }]
          : []),
        ...(form.geoDistanceKm === "far"
          ? [{ type: "GEO_DISTANCE_ANOMALY" as const, value: true }]
          : []),
      ],
    };
  }

  async function runHero(key: string) {
    const scenario = DEMO_PRESETS.find((s) => s.id === key);
    if (!scenario) return;
    setBusyHero(key);
    const req = scenario.build();
    setForm(syncFormFromRequest(req));
    const slot: SlotKey = slots.left === null ? "left" : "right";
    await evaluate(req, slot);
    setBusyHero(null);
  }

  async function handleReset() {
    try {
      await api.resetDemo();
      setSlots({ left: null, right: null });
      setBannerError(null);
    } catch (err) {
      setBannerError("Reset failed.");
    }
  }

  async function refreshSlot(slot: SlotKey) {
    const record = slots[slot];
    if (!record) return;
    try {
      const decision = await api.getDecision(record.decision.decisionId);
      setSlots((s) =>
        s[slot] ? { ...s, [slot]: { decision, createdAt: s[slot]!.createdAt } } : s
      );
    } catch {
      // refresh is best-effort (e.g. challenge outcome trace events)
    }
  }

  const selectedUser = useMemo(
    () => DEMO_USERS.find((u) => u.id === form.userId) ?? DEMO_USERS[0],
    [form.userId]
  );

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">◈</span>
          <div>
            <h1>Threat-Aware MFA</h1>
            <p className="tagline">
              Risk decides how much authentication is required. Threat context
              decides which authentication factors should not be trusted.
            </p>
          </div>
        </div>
        <div className="topbar-right">
          <span className={`health health-${health}`} title="API /health">
            API {health}
          </span>
          <button className="btn ghost" onClick={handleReset} type="button">
            Reset demo
          </button>
        </div>
      </header>

      <section className="hero-strip">
        <div className="hero-strip-head">
          <span className="panel-kicker">One-click judge scenarios</span>
          <p>
            Same ₹50,000 · same new payee · same high risk. Different suspected
            attack paths — created through the backend, compared side by side.
          </p>
        </div>
        <div className="hero-buttons">
          {DEMO_PRESETS.map((s) => (
            <button
              key={s.id}
              className="hero-card"
              disabled={busyHero !== null}
              onClick={() => void runHero(s.id)}
              type="button"
            >
              <span className="hero-card-title">
                {busyHero === s.id ? "Evaluating…" : s.label}
              </span>
              <span className="hero-card-sub">{s.tagline}</span>
            </button>
          ))}
        </div>
      </section>

      <PasskeyPanel userId={form.userId} users={DEMO_USERS} onChanged={() => undefined} />

      {bannerError ? (
        <div className="banner-error" role="alert">
          {bannerError}
        </div>
      ) : null}

      <main className="layout">
        <aside className="form-column">
          <TransactionForm
            users={DEMO_USERS}
            form={form}
            onChange={setForm}
            onSubmit={(target) =>
              void evaluate(formToRequest(`custom_${target}_${Date.now()}`), target)
            }
            submitting={submitting}
          />
        </aside>

        <section className="panels-column">
          {slots.left ? (
            <DecisionPanel
              decision={slots.left.decision}
              slot="left"
              onRefresh={() => refreshSlot("left")}
            />
          ) : (
            <EmptyPanel hint="Run a judge scenario or evaluate a transaction to see the backend decision." />
          )}
          {slots.right ? (
            <DecisionPanel
              decision={slots.right.decision}
              slot="right"
              onRefresh={() => refreshSlot("right")}
            />
          ) : null}
        </section>
      </main>

      <footer className="footer">
        <span>
          Deterministic demonstration policy v{slots.left?.decision.policy.version ?? "—"} ·
          synthetic signals · no live provider, bank, or telecom integration ·
          selected user: {selectedUser.name}
        </span>
      </footer>
    </div>
  );
}

function EmptyPanel({ hint }: { hint: string }) {
  return (
    <div className="empty-panel">
      <span className="empty-icon">◈</span>
      <p>{hint}</p>
    </div>
  );
}

function syncFormFromRequest(req: CreateDecisionRequest): FormState {
  const s = req.session;
  const overrides = req.evidenceOverrides ?? [];
  const sim = overrides.find((o) => o.type === "RECENT_SIM_CHANGE");
  const phish = overrides.find((o) => o.type === "PHISHING_RELAY_INDICATOR");
  const geo = overrides.find((o) => o.type === "GEO_DISTANCE_ANOMALY");
  return {
    userId: req.userId,
    amountRupees: req.transaction.amountMinor / 100,
    payeeIsKnown: req.transaction.payeeIsKnown,
    deviceId: s.deviceId,
    sessionId: s.sessionId,
    ageSeconds: s.ageSeconds,
    failedLoginCount: s.failedLoginCount,
    ipAddress: s.ipAddress,
    asn: s.asn,
    country: s.country,
    recentSimChange: sim?.value === true ? "true" : "false",
    phishingRelay: phish?.value === true,
    geoDistanceKm: geo?.value === true ? "far" : "unknown",
  };
}
