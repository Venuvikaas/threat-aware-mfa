/**
 * Challenge execution + enforcement demo (EXECUTION_new2.md §5.3, Phase 5).
 *
 * Two paths, both through the API so the backend enforces policy:
 *
 *   1. "Continue" with the SELECTED factor — a challenge is created only
 *      because the persisted decision marks that factor ELIGIBLE. PASSKEY
 *      returns mode SIMULATED (labeled fallback) or WEBAUTHN (real
 *      ceremony); the panel runs whichever the backend picked and says so.
 *
 *   2. "Try SMS OTP anyway" — the backend refuses with POLICY_REJECTION:
 *      the wow-moment proof that challenge creation re-checks the persisted
 *      factor decision instead of trusting the client.
 */
import { useState } from "react";
import type { FactorEvaluation, FactorId } from "@mfa/contracts";
import { api, ApiError } from "../lib/api";
import { getPasskeyAssertion, isWebAuthnAvailable } from "../lib/webauthn";
import type { ChallengeFlow } from "../types";

interface Props {
  decisionId: string;
  factors: FactorEvaluation[];
  selectedFactorId: FactorId | null;
  action: "CHALLENGE" | "ASSISTED_RECOVERY";
  onOutcome: () => void | Promise<void>;
}

function extractError(err: unknown): { code: string; message: string; details?: unknown } {
  if (err instanceof ApiError) {
    return { code: err.code, message: err.message, details: err.details };
  }
  return { code: "UNKNOWN", message: err instanceof Error ? err.message : String(err) };
}

export function ChallengePanel({
  decisionId,
  factors,
  selectedFactorId,
  action,
  onOutcome,
}: Props) {
  const [flow, setFlow] = useState<ChallengeFlow>({
    slot: "left",
    factor: null,
    phase: "idle",
    challenge: null,
    verification: null,
    error: null,
    ceremonyInterrupted: false,
  });
  const [busy, setBusy] = useState(false);
  const webauthnOk = isWebAuthnAvailable();

  const selected = factors.find((f) => f.factorId === selectedFactorId);
  const selectedEligible = selected?.status === "ELIGIBLE";

  async function create(factor: FactorId, preferSimulated = false) {
    setBusy(true);
    setFlow((f) => ({ ...f, factor, phase: "creating", error: null, ceremonyInterrupted: false }));
    try {
      const challenge = await api.createChallenge(decisionId, factor, preferSimulated);
      setFlow((f) => ({ ...f, challenge, phase: "ready" }));
    } catch (err) {
      setFlow((f) => ({ ...f, error: extractError(err), phase: "rejected" }));
    } finally {
      setBusy(false);
    }
  }

  async function verifySimulated() {
    const { challenge } = flow;
    if (!challenge) return;
    setBusy(true);
    setFlow((f) => ({ ...f, phase: "verifying" }));
    try {
      const verification = await api.verifyChallenge(challenge.challengeId, {
        simulatedOk: true,
      });
      setFlow((f) => ({ ...f, verification, phase: "verified" }));
      await onOutcome();
    } catch (err) {
      setFlow((f) => ({ ...f, error: extractError(err), phase: "rejected" }));
    } finally {
      setBusy(false);
    }
  }

  async function verifyWebAuthn() {
    const { challenge } = flow;
    if (!challenge) return;
    setBusy(true);
    setFlow((f) => ({ ...f, phase: "verifying", error: null }));
    try {
      const assertion = await getPasskeyAssertion(challenge.publicOptions);
      const verification = await api.verifyChallenge(challenge.challengeId, assertion);
      setFlow((f) => ({ ...f, verification, phase: "verified" }));
      await onOutcome();
    } catch (err) {
      setFlow((f) => ({
        ...f,
        error: extractError(err),
        phase: "rejected",
        ceremonyInterrupted: true,
      }));
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setFlow({
      slot: "left",
      factor: null,
      phase: "idle",
      challenge: null,
      verification: null,
      error: null,
      ceremonyInterrupted: false,
    });
  }

  const isSimulated = flow.challenge?.mode === "SIMULATED";
  const isWebAuthn = flow.challenge?.mode === "WEBAUTHN";

  return (
    <section className="panel-section challenge-section">
      <div className="section-head-row">
        <div className="section-title">Challenge execution</div>
        {flow.phase !== "idle" ? (
          <button className="btn ghost small" onClick={reset} type="button">
            Reset flow
          </button>
        ) : null}
      </div>

      <p className="panel-note">
        Every challenge is created through <code>POST /api/v1/challenges</code>.
        The backend refuses to issue a challenge for a factor the persisted
        decision did not mark eligible.
      </p>

      {action === "ASSISTED_RECOVERY" ? (
        <div className="challenge-recovery">
          <span className="recovery-icon">!</span>
          <p>
            No factor is eligible — the decision requires{" "}
            <strong>assisted recovery</strong>. There is nothing to challenge;
            issuing one would fail the policy gate.
          </p>
        </div>
      ) : (
        <div className="challenge-actions">
          <button
            className="btn primary"
            type="button"
            disabled={busy || !selectedEligible || flow.phase === "verified" || flow.phase === "creating"}
            onClick={() =>
              void create(selectedFactorId!, selectedFactorId === "PASSKEY" ? !webauthnOk : false)
            }
          >
            {flow.phase === "creating"
              ? "Creating challenge…"
              : flow.phase === "verified"
                ? "Challenge verified ✓"
                : selectedFactorId === "PASSKEY" && !webauthnOk
                  ? "Continue with PASSKEY (simulated)"
                  : `Continue with ${selectedFactorId}`}
          </button>

          {/* Enforcement proof point: try a factor the policy blocked. */}
          {factors
            .filter((f) => f.status !== "ELIGIBLE")
            .slice(0, 1)
            .map((f) => (
              <button
                key={f.factorId}
                className="btn danger-ghost"
                type="button"
                disabled={busy}
                onClick={() => void create(f.factorId)}
              >
                Try {f.factorId} anyway (blocked)
              </button>
            ))}
        </div>
      )}

      {flow.challenge && flow.phase === "ready" ? (
        <div className={`flow-banner flow-${flow.phase}`}>
          <div className="flow-ready-meta">
            {isSimulated ? (
              <span className="chip chip-sim">SIMULATED · labeled demo fallback</span>
            ) : (
              <span className="chip chip-real">REAL PASSKEY · WEBAUTHN</span>
            )}
            <code className="challenge-id">{flow.challenge.challengeId}</code>
            <span className="muted">expires {new Date(flow.challenge.expiresAt).toLocaleTimeString()}</span>
          </div>
          {isWebAuthn ? (
            <p className="form-note">
              Real WebAuthn ceremony — your authenticator will be prompted. If
              it cannot complete, the API's labeled simulated fallback is one
              click away.
            </p>
          ) : null}
          <button
            className="btn primary"
            type="button"
            disabled={busy}
            onClick={isWebAuthn ? verifyWebAuthn : verifySimulated}
          >
            {busy
              ? "Verifying…"
              : isWebAuthn
                ? "Verify with passkey (WebAuthn)"
                : "Verify with simulated passkey"}
          </button>
        </div>
      ) : null}

      {flow.phase === "verifying" ? (
        <div className="flow-banner flow-verifying">
          {isWebAuthn ? "Awaiting authenticator verification…" : "Verifying challenge…"}
        </div>
      ) : null}

      {flow.verification && flow.phase === "verified" ? (
        <div className="flow-banner flow-verified">
          <span className="verification-icon">✓</span>
          <div>
            <div className="flow-title">Challenge verified</div>
            <div className="verification-line">
              transaction status: <strong>{flow.verification.transactionStatus}</strong>
            </div>
          </div>
        </div>
      ) : null}

      {flow.error && flow.phase === "rejected" ? (
        <div className="flow-banner flow-rejected">
          <span className="rejection-icon">⊘</span>
          <div className="rejection-body">
            <div className="flow-title">
              {flow.error.code} — {flow.ceremonyInterrupted ? "ceremony did not complete" : "refused by persisted policy"}
            </div>
            <p className="rejection-message">{flow.error.message}</p>
            {flow.ceremonyInterrupted && flow.factor === "PASSKEY" ? (
              <button
                className="btn ghost"
                type="button"
                disabled={busy}
                onClick={() => void create("PASSKEY", true)}
              >
                Use the simulated passkey instead (demo fallback)
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
