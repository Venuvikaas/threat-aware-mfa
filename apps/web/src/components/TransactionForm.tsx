/**
 * Transaction submission form (docs/EXECUTION.md Phase 5).
 *
 * Everything here is an INPUT to the backend decision service. The form never
 * computes a decision.
 */
import type { ReactNode } from "react";
import type { DemoUser } from "../lib/api";
import type { FormState } from "../types";

interface Props {
  users: DemoUser[];
  form: FormState;
  onChange: (form: FormState) => void;
  onSubmit: (target: "left" | "right") => void;
  submitting: boolean;
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint ? <span className="field-hint">{hint}</span> : null}
    </label>
  );
}

export function TransactionForm({
  users,
  form,
  onChange,
  onSubmit,
  submitting,
}: Props) {
  const user = users.find((u) => u.id === form.userId);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    onChange({ ...form, [key]: value });

  return (
    <form
      className="transaction-form"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit("left");
      }}
    >
      <div className="form-section-title">
        <span>Transaction signals</span>
        <span className="form-section-note">submitted to POST /api/v1/decisions</span>
      </div>

      <div className="form-grid">
        <Field label="Customer (synthetic)">
          <select
            value={form.userId}
            onChange={(e) => set("userId", e.target.value)}
          >
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} — {u.passkeyEnrolled ? "passkey enrolled" : "no passkey"}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Amount (₹)">
          <input
            type="number"
            min={100}
            step={100}
            value={form.amountRupees}
            onChange={(e) => set("amountRupees", Number(e.target.value))}
          />
        </Field>

        <Field label="Payee">
          <div className="segmented">
            <button
              type="button"
              className={form.payeeIsKnown ? "" : "active"}
              onClick={() => set("payeeIsKnown", false)}
            >
              New payee
            </button>
            <button
              type="button"
              className={form.payeeIsKnown ? "active" : ""}
              onClick={() => set("payeeIsKnown", true)}
            >
              Known payee
            </button>
          </div>
        </Field>

        <Field label="Device profile">
          <select
            value={form.deviceId}
            onChange={(e) => {
              const id = e.target.value;
              if (id === "dev_trusted_01") {
                onChange({
                  ...form,
                  deviceId: id,
                  deviceTrusted: true,
                  deviceFirstSeen: false,
                });
              } else {
                onChange({
                  ...form,
                  deviceId: id,
                  deviceTrusted: false,
                  deviceFirstSeen: true,
                });
              }
            }}
          >
            <option value="dev_trusted_01">Home laptop — trusted</option>
            <option value="dev_new_01">Unregistered mobile — first seen</option>
          </select>
        </Field>

        <Field label="Session profile">
          <select
            value={form.sessionId}
            onChange={(e) => {
              const id = e.target.value;
              onChange(
                id === "sess_home_01"
                  ? {
                      ...form,
                      sessionId: id,
                      ageSeconds: 3600,
                      failedLoginCount: 0,
                      ipAddress: "203.0.113.10",
                      asn: "AS14061",
                      country: "IN",
                    }
                  : {
                      ...form,
                      sessionId: id,
                      ageSeconds: 120,
                      failedLoginCount: 2,
                      ipAddress: "198.51.100.44",
                      asn: "AS16509",
                      country: "US",
                    }
              );
            }}
          >
            <option value="sess_home_01">Normal home session</option>
            <option value="sess_unusual_01">Unusual session (2 failed logins)</option>
          </select>
        </Field>

        <Field label="Recent SIM change">
          <div className="segmented tri">
            <button
              type="button"
              className={form.recentSimChange === "false" ? "active" : ""}
              onClick={() => set("recentSimChange", "false")}
            >
              No
            </button>
            <button
              type="button"
              className={form.recentSimChange === "unknown" ? "active" : ""}
              onClick={() => set("recentSimChange", "unknown")}
            >
              Unknown
            </button>
            <button
              type="button"
              className={form.recentSimChange === "true" ? "active" : ""}
              onClick={() => set("recentSimChange", "true")}
            >
              Yes
            </button>
          </div>
        </Field>

        <Field label="Geo distance from last login">
          <div className="segmented tri">
            <button
              type="button"
              className={form.geoDistance === "unknown" ? "active" : ""}
              onClick={() => set("geoDistance", "unknown")}
            >
              Unknown
            </button>
            <button
              type="button"
              className={form.geoDistance === "near" ? "active" : ""}
              onClick={() => set("geoDistance", "near")}
            >
              &lt; 500 km
            </button>
            <button
              type="button"
              className={form.geoDistance === "far" ? "active" : ""}
              onClick={() => set("geoDistance", "far")}
            >
              ≥ 500 km
            </button>
          </div>
        </Field>

        <Field label="Phishing-relay indicator">
          <div className="segmented">
            <button
              type="button"
              className={!form.phishingRelay ? "active" : ""}
              onClick={() => set("phishingRelay", false)}
            >
              Not observed
            </button>
            <button
              type="button"
              className={form.phishingRelay ? "active" : ""}
              onClick={() => set("phishingRelay", true)}
            >
              Observed
            </button>
          </div>
        </Field>
      </div>

      <div className="form-actions">
        <button className="btn primary" type="submit" disabled={submitting}>
          {submitting ? "Evaluating…" : "Evaluate transaction"}
        </button>
        <button
          className="btn ghost"
          type="button"
          disabled={submitting}
          onClick={() => onSubmit("right")}
        >
          Evaluate as second scenario →
        </button>
      </div>
      {user && !user.passkeyEnrolled ? (
        <p className="form-note warn">
          {user.name} has no passkey enrolled — expect assisted recovery when
          SMS OTP is blocked.
        </p>
      ) : null}
    </form>
  );
}
