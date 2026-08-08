/**
 * Passkey enrollment panel (EXECUTION_new2.md Phase 5 / Stretch A).
 *
 * Demo passkey enrollment for the selected synthetic user. Runs a REAL
 * WebAuthn registration ceremony when the origin is WebAuthn-capable; the
 * panel says so explicitly. When it is not capable, it tells the presenter
 * that passkey challenges will use the labeled SIMULATED fallback — the
 * fallback is never hidden.
 */
import { useState } from "react";
import type { DemoUser } from "@mfa/demo-data";
import { ApiError } from "../lib/api";
import { enrollPasskey, isWebAuthnAvailable } from "../lib/webauthn";

interface Props {
  userId: string;
  users: DemoUser[];
  onChanged: () => void | Promise<void>;
}

export function PasskeyPanel({ userId, users, onChanged }: Props) {
  const user = users.find((u) => u.id === userId);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const webauthnOk = isWebAuthnAvailable();

  async function handleEnroll() {
    setBusy(true);
    setMessage(null);
    try {
      const result = await enrollPasskey(userId);
      setMessage({
        ok: true,
        text: `Passkey registered — credential ${result.credentialId.slice(0, 10)}… stored (public data only).`,
      });
      await onChanged();
    } catch (err) {
      const text =
        err instanceof ApiError
          ? `${err.code}: ${err.message}`
          : err instanceof Error
            ? err.message
            : String(err);
      setMessage({ ok: false, text });
    } finally {
      setBusy(false);
    }
  }

  if (!user) return null;

  const enrolled = user.capabilities.PASSKEY_ENROLLED;

  return (
    <section className="passkey-panel">
      <div className="passkey-head">
        <span className="panel-kicker">Real passkey · WebAuthn</span>
        <span className={`passkey-capable ${webauthnOk ? "ok" : "no"}`}>
          {webauthnOk
            ? "WebAuthn available on this origin"
            : "WebAuthn not available here — simulated fallback in effect"}
        </span>
      </div>
      <div className="passkey-body">
        <div className="passkey-status">
          <span>
            <strong>{user.name}</strong>
          </span>
          <span className="chip">
            {enrolled ? "capability: passkey enrolled" : "capability: not enrolled"}
          </span>
        </div>
        <button
          className="btn ghost"
          type="button"
          disabled={busy || !webauthnOk}
          onClick={() => void handleEnroll()}
        >
          {busy
            ? "Awaiting browser prompt…"
            : enrolled
              ? "Enroll another passkey"
              : "Enroll passkey (real ceremony)"}
        </button>
        {!webauthnOk ? (
          <p className="form-note warn">
            This page is not a WebAuthn secure context (WebAuthn needs https or
            localhost). Real ceremonies cannot run here; passkey challenges
            will use the clearly labeled simulated adapter.
          </p>
        ) : null}
        {message ? (
          <p className={`form-note ${message.ok ? "" : "warn"}`}>{message.text}</p>
        ) : null}
      </div>
    </section>
  );
}
