/**
 * Transaction submission form (EXECUTION_new2.md Phase 5).
 *
 * Everything here is an INPUT to the backend decision service. Demo evidence
 * toggles map to the frozen evidence-override contract; the form never
 * computes a decision.
 */
import type { ReactNode } from "react";
import type { DemoUser } from "@mfa/demo-data";
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

function Toggle({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={`toggle ${active ? "active" : ""}`}
      onClick={onClick}
    >
      <span className="toggle-dot" />
      {children}
    </button>
  );
}

export function TransactionForm({ users, form, onChange, onSubmit, submitting }: Props) {
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
        <span>Transaction context</span>
        <span className="form-section-note">submitted to POST /api/v1/decisions</span>
      </div>

      <div className="form-grid">
        <Field label="Customer (synthetic)">
          <select value={form.userId} onChange={(e) => set("userId", e.target.value)}>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} —{" "}
                {u.capabilities.PASSKEY_ENROLLED ? "passkey enrolled" : "no passkey"}
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
              className={!form.payeeIsKnown ? "active" : ""}
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
              onChange({
                ...form,
                deviceId: id,
                sessionId:
                  id === "dev_trusted_01" ? "sess_home_01" : form.sessionId,
                ageSeconds: id === "dev_trusted_01" ? 3600 : form.ageSeconds,
                failedLoginCount: id === "dev_trusted_01" ? 0 : form.failedLoginCount,
                ipAddress: id === "dev_trusted_01" ? "203.0.113.10" : form.ipAddress,
                asn: id === "dev_trusted_01" ? "AS14061" : form.asn,
                country: id === "dev_trusted_01" ? "IN" : form.country,
              });
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
      </div>

      <div className="form-section-title">
        <span>Evidence overrides</span>
        <span className="form-section-note">demo mode — synthetic signals</span>
      </div>

      <div className="toggle-grid">
        <Toggle active={form.recentSimChange === "true"} onClick={() => set("recentSimChange", form.recentSimChange === "true" ? "false" : "true")}>
          Recent SIM change
        </Toggle>
        <Toggle active={form.phishingRelay} onClick={() => set("phishingRelay", !form.phishingRelay)}>
          Phishing-relay indicator
        </Toggle>
        <Toggle active={form.geoDistanceKm === "far"} onClick={() => set("geoDistanceKm", form.geoDistanceKm === "far" ? "unknown" : "far")}>
          Geo distance ≥ 500 km
        </Toggle>
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
      {user && !user.capabilities.PASSKEY_ENROLLED ? (
        <p className="form-note warn">
          {user.name} has no passkey enrolled — expect assisted recovery when
          SMS OTP is blocked.
        </p>
      ) : null}
    </form>
  );
}
