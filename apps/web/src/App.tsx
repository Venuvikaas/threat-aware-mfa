/**
 * Threat-Aware MFA Decision Service — client (docs/EXECUTION.md Phase 5/9).
 *
 * The client submits transactions to the backend and renders what the API
 * returns. No decision logic lives here: risk, threat, factor eligibility,
 * and the scalar baseline are all computed by the API.
 */
import { useCallback, useEffect, useState } from "react";
import type { CreateDecisionRequest } from "@mfa/contracts";
import { api, ApiError, type DemoUser } from "./lib/api";
import { HERO_SCENARIOS } from "./lib/presets";
import type { DecisionRecord, FormState, SlotKey } from "./types";
import { ComparisonBanner } from "./components/ComparisonBanner";
import { PasskeyPanel } from "./components/PasskeyPanel";
import { DecisionPanel } from "./components/DecisionPanel";
import { TransactionForm } from "./components/TransactionForm";

const DEFAULT_FORM: FormState = {
  userId: "user_demo_01",
  amountRupees: 50000,
  payeeIsKnown: false,
  deviceId: "dev_new_01",
  deviceTrusted: false,
  deviceFirstSeen: true,
  sessionId: "sess_unusual_01",
  ageSeconds: 120,
  failedLoginCount: 2,
  ipAddress: "198.51.100.44",
  asn: "AS16509",
  country: "US",
  recentSimChange: "true",
  geoDistance: "unknown",
  phishingRelay: false,
};

export function App() {
  const [users, setUsers] = useState<DemoUser[]>([]);
  const [health, setHealth] = useState<string>("checking");
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [slots, setSlots] = useState<{ left: DecisionRecord | null; right: DecisionRecord | null }>({
    left: null,
    right: null,
  });
  const [submitting, setSubmitting] = useState(false);
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [busyHero, setBusyHero] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    try {
      const res = await api.demoUsers();
      setUsers(res.users);
    } catch (err) {
      setBannerError("Could not load demo identities — is the API running?");
    }
  }, []);

  useEffect(() => {
    void loadUsers();
    api
      .health()
      .then((h) => setHealth(h.database === "ok" ? "online" : "degraded"))
      .catch(() => setHealth("offline"));
  }, [loadUsers]);

  async function evaluate(req: CreateDecisionRequest, slot: SlotKey) {
    setBannerError(null);
    setSubmitting(true);
    try {
      const decision = await api.createDecision(req);
      const [audit, signals] = await Promise.all([
        api.getAudit(decision.decisionId),
        api.getSignals(decision.decisionId),
      ]);
      let baseline = null;
      try {
        baseline = await api.baseline(decision.risk.level);
      } catch {
        baseline = null;
      }
      setSlots((s) => ({
        ...s,
        [slot]: {
          decision,
          audit,
          signals,
          baseline,
          createdAt: new Date().toISOString(),
        },
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
    const geo =
      form.geoDistance === "far" ? 700 : form.geoDistance === "near" ? 120 : null;
    return {
      userId: form.userId,
      transaction: {
        clientTransactionId,
        amountMinor: Math.round(form.amountRupees * 100),
        currency: "INR",
        payeeId: form.payeeIsKnown ? "payee_known_01" : `payee_${Date.now()}`,
        payeeIsKnown: form.payeeIsKnown,
      },
      session: {
        sessionId: form.sessionId,
        ageSeconds: form.ageSeconds,
        failedLoginCount: form.failedLoginCount,
        ipAddress: form.ipAddress,
        asn: form.asn,
        country: form.country,
      },
      device: {
        deviceId: form.deviceId,
        trusted: form.deviceTrusted,
        firstSeen: form.deviceFirstSeen,
        browserFingerprint:
          form.deviceId === "dev_trusted_01"
            ? "fp-home-chrome-win-7a9f"
            : "fp-unregistered-mobile-42c1",
      },
      signals: {
        recentSimChange:
          form.recentSimChange === "true"
            ? true
            : form.recentSimChange === "false"
              ? false
              : null,
        geoDistanceFromLastLoginKm: geo,
        phishingRelayIndicator: form.phishingRelay,
      },
    };
  }

  async function runHero(key: string) {
    const scenario = HERO_SCENARIOS.find((s) => s.key === key);
    if (!scenario) return;
    setBusyHero(key);
    // Fill the form so the presenter can narrate the inputs, then evaluate.
    const req = scenario.build();
    setForm(syncFormFromRequest(req));
    const slot: SlotKey = slots.left === null ? "left" : "right";
    await evaluate(req, slot);
    setBusyHero(null);
  }

  async function handleReset() {
    try {
      await api.reset();
      setSlots({ left: null, right: null });
      setBannerError(null);
      await loadUsers();
    } catch (err) {
      setBannerError("Reset failed.");
    }
  }

  async function refreshSlot(slot: SlotKey) {
    const record = slots[slot];
    if (!record) return;
    try {
      const audit = await api.getAudit(record.decision.decisionId);
      setSlots((s) =>
        s[slot] ? { ...s, [slot]: { ...(s[slot] as DecisionRecord), audit } } : s
      );
    } catch {
      // audit refresh is best-effort
    }
  }

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
          <span className="panel-kicker">One-click hero scenarios</span>
          <p>
            Same ₹50,000 · same new payee · same high-risk score. Different
            suspected attack paths — created through the backend, compared side
            by side.
          </p>
        </div>
        <div className="hero-buttons">
          {HERO_SCENARIOS.map((s) => (
            <button
              key={s.key}
              className="hero-card"
              disabled={busyHero !== null}
              onClick={() => void runHero(s.key)}
              type="button"
            >
              <span className="hero-card-title">
                {busyHero === s.key ? "Evaluating…" : s.label}
              </span>
              <span className="hero-card-sub">{s.tagline}</span>
            </button>
          ))}
        </div>
      </section>

      <PasskeyPanel
        userId={form.userId}
        users={users}
        onChanged={loadUsers}
      />

      {bannerError ? (
        <div className="banner-error" role="alert">
          {bannerError}
        </div>
      ) : null}

      {slots.left && slots.right ? (
        <ComparisonBanner left={slots.left} right={slots.right} />
      ) : null}

      <main className="layout">
        <aside className="form-column">
          <TransactionForm
            users={users}
            form={form}
            onChange={setForm}
            onSubmit={(target) =>
              void evaluate(
                formToRequest(`custom_${target}_${Date.now()}`),
                target
              )
            }
            submitting={submitting}
          />
        </aside>

        <section className="panels-column">
          {slots.left ? (
            <DecisionPanel record={slots.left} slot="left" onStale={refreshSlot} />
          ) : (
            <EmptyPanel hint="Run a hero scenario or evaluate a transaction to see the backend decision." />
          )}
          {slots.right ? (
            <DecisionPanel record={slots.right} slot="right" onStale={refreshSlot} />
          ) : null}
        </section>
      </main>

      <footer className="footer">
        <span>
          Deterministic demonstration policy v{slots.left?.decision.policyVersion ?? "—"} ·
          synthetic signals · no live provider, bank, or telecom integration
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
  return {
    userId: req.userId,
    amountRupees: req.transaction.amountMinor / 100,
    payeeIsKnown: req.transaction.payeeIsKnown,
    deviceId: req.device.deviceId,
    deviceTrusted: req.device.trusted,
    deviceFirstSeen: req.device.firstSeen,
    sessionId: s.sessionId,
    ageSeconds: s.ageSeconds,
    failedLoginCount: s.failedLoginCount,
    ipAddress: s.ipAddress,
    asn: s.asn,
    country: s.country,
    recentSimChange:
      req.signals.recentSimChange === true
        ? "true"
        : req.signals.recentSimChange === false
          ? "false"
          : "unknown",
    geoDistance:
      req.signals.geoDistanceFromLastLoginKm === null
        ? "unknown"
        : (req.signals.geoDistanceFromLastLoginKm ?? 0) >= 500
          ? "far"
          : "near",
    phishingRelay: req.signals.phishingRelayIndicator,
  };
}
