/**
 * Decision panel (docs/EXECUTION.md Phase 5/9, Phase 7 WebAuthn).
 *
 * Renders ONLY what the backend returned: risk, threat, factor eligibility,
 * selected factor / recovery, persisted audit trail, and signal provenance.
 * Factor challenges are executed through the API so the backend enforces
 * blocked-factor policy (the wow-moment proof).
 *
 * Phase 7: a PASSKEY challenge comes back in mode WEBAUTHN (real ceremony) or
 * mode SIMULATED (labeled automatic fallback). The panel runs the browser
 * ceremony for WEBAUTHN challenges, and if that ceremony cannot complete it
 * offers the explicitly labeled simulated fallback through the API — the
 * fallback is never hidden or ambiguous.
 */
import { useState } from "react";
import type {
  CreateChallengeResponse,
  FactorDecision,
  FactorId,
} from "@mfa/contracts";
import { api, ApiError } from "../lib/api";
import { getPasskeyAssertion } from "../lib/webauthn";
import type { DecisionRecord, SlotKey } from "../types";
import { AuditTimeline } from "./AuditTimeline";
import { JsonInspector } from "./JsonInspector";

interface Props {
  record: DecisionRecord;
  slot: SlotKey;
  onStale: (slot: SlotKey) => void;
}

const THREAT_COPY: Record<string, { label: string; distrusted: string; blurb: string }> = {
  SIM_CHANNEL_COMPROMISE: {
    label: "SIM channel compromise",
    distrusted: "The phone number — SMS channel",
    blurb:
      "A recent SIM change places the SMS channel under suspicion, so one-time codes sent to the phone cannot be trusted.",
  },
  PHISHING: {
    label: "Phishing relay",
    distrusted: "The SMS relay path — one-time code delivery",
    blurb:
      "A phishing-relay indicator means the one-time-code delivery path may be relayable to an attacker.",
  },
  INSUFFICIENT_EVIDENCE: {
    label: "Insufficient evidence",
    distrusted: "No channel is specifically under suspicion",
    blurb:
      "No supported primary indicator is present, so the policy stays conservative rather than inventing a confident hypothesis.",
  },
};

const REASON_DISPLAY: Record<string, string> = {
  sms_channel_untrusted: "SMS channel untrusted under this hypothesis",
  factor_relayable: "SMS codes relayable under this hypothesis",
  passkey_not_enrolled: "Not enrolled",
  assurance_too_low: "Below required assurance",
  factor_eligible: "Eligible",
};

function riskClass(level: string): string {
  return level === "HIGH" ? "risk-high" : level === "MEDIUM" ? "risk-medium" : "risk-low";
}

export function DecisionPanel({ record, slot, onStale }: Props) {
  const { decision, baseline } = record;
  const [phase, setPhase] = useState<
    "idle" | "creating" | "ready" | "verifying" | "verified" | "rejected"
  >("idle");
  const [challenge, setChallenge] = useState<CreateChallengeResponse | null>(null);
  const [verification, setVerification] = useState<string | null>(null);
  const [flowError, setFlowError] = useState<{ code: string; message: string } | null>(null);
  const [busyFactor, setBusyFactor] = useState<FactorId | null>(null);
  /** The WebAuthn browser ceremony failed — offer the labeled simulated fallback. */
  const [ceremonyInterrupted, setCeremonyInterrupted] = useState(false);

  const threat = THREAT_COPY[decision.threat.type] ?? THREAT_COPY.INSUFFICIENT_EVIDENCE;

  async function runChallenge(factor: FactorId, preferSimulated = false) {
    setBusyFactor(factor);
    setFlowError(null);
    setCeremonyInterrupted(false);
    setPhase("creating");
    try {
      const created = await api.createChallenge({
        decisionId: decision.decisionId,
        factor,
        ...(preferSimulated ? { preferSimulated: true } : {}),
      });
      setChallenge(created);
      setPhase("ready");
    } catch (err) {
      setFlowError(extractError(err));
      setPhase("rejected");
    } finally {
      setBusyFactor(null);
    }
  }

  async function verifySimulated() {
    if (!challenge) return;
    setPhase("verifying");
    try {
      const result = await api.verifyChallenge(challenge.challengeId, {
        simulatedOk: true,
      });
      setVerification(`${result.verified ? "AUTHORIZED" : "DENIED"} · ${result.transactionStatus}`);
      setPhase("verified");
      onStale(slot);
    } catch (err) {
      setFlowError(extractError(err));
      setPhase("rejected");
    }
  }

  async function verifyWebAuthn() {
    if (!challenge) return;
    setPhase("verifying");
    setFlowError(null);
    try {
      const assertion = await getPasskeyAssertion(challenge.publicOptions);
      const result = await api.verifyChallenge(challenge.challengeId, assertion);
      setVerification(`${result.verified ? "AUTHORIZED" : "DENIED"} · ${result.transactionStatus}`);
      setPhase("verified");
      onStale(slot);
    } catch (err) {
      setFlowError(extractError(err));
      setCeremonyInterrupted(true);
      setPhase("rejected");
    }
  }

  const blockedFactor = decision.factors.find((f) => f.status === "BLOCKED");
  const isWebAuthn = challenge?.mode === "WEBAUTHN";

  return (
    <article className={`decision-panel ${slot === "right" ? "slot-right" : "slot-left"}`}>
      <header className="panel-head">
        <div className="panel-head-main">
          <span className="panel-kicker">Backend decision</span>
          <code className="decision-id">{decision.decisionId}</code>
        </div>
        <div className="panel-head-meta">
          <span className="chip">policy {decision.policyVersion}</span>
          <span className="chip chip-muted">{decision.createdAt}</span>
        </div>
      </header>

      {/* Risk */}
      <section className="panel-section">
        <div className="section-row">
          <div className={`risk-badge ${riskClass(decision.risk.level)}`}>
            <span className="risk-label">RISK</span>
            <span className="risk-value">{decision.risk.level}</span>
          </div>
          <div className="reason-list">
            {decision.risk.reasons.length === 0 ? (
              <span className="muted">No risk indicators triggered</span>
            ) : (
              decision.risk.reasons.map((r) => (
                <span key={r} className="reason-chip">
                  {r}
                </span>
              ))
            )}
          </div>
        </div>
      </section>

      {/* Threat */}
      <section className="panel-section threat-section">
        <div className="threat-grid">
          <div className="threat-main">
            <div className="section-title">Suspected threat</div>
            <div className={`threat-badge threat-${decision.threat.type.toLowerCase()}`}>
              {threat.label}
            </div>
            <div className="support-line">
              support: <strong>{decision.threat.support}</strong>
            </div>
            <p className="threat-blurb">{threat.blurb}</p>
            <div className="distrust">
              <span className="distrust-label">Do not trust</span>
              <span>{threat.distrusted}</span>
            </div>
            <div className="reason-list">
              {decision.threat.evidence.map((e) => (
                <span key={e} className="reason-chip evidence">
                  {e}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Factors */}
      <section className="panel-section">
        <div className="section-title">Factor eligibility</div>
        <div className="factor-cards">
          {decision.factors.map((f) => (
            <FactorCard key={f.factor} f={f} />
          ))}
        </div>
        {phase !== "idle" && phase !== "verified" ? (
          <div className={`flow-banner flow-${phase}`}>
            {phase === "creating" ? (
              <span>Creating challenge…</span>
            ) : phase === "ready" && challenge ? (
              <div className="flow-ready">
                <div className="flow-ready-meta">
                  {isWebAuthn ? (
                    <span className="chip chip-real">REAL PASSKEY · WEBAUTHN</span>
                  ) : (
                    <span className="chip chip-sim">SIMULATED · labeled demo fallback</span>
                  )}
                  <code className="challenge-id">{challenge.challengeId}</code>
                  <span className="muted">expires {challenge.expiresAt}</span>
                </div>
                {isWebAuthn ? (
                  <p className="form-note">
                    Real WebAuthn ceremony — your authenticator will be prompted.
                  </p>
                ) : (
                  <p className="form-note">
                    Simulated adapter fallback: no real ceremony runs for this challenge.
                  </p>
                )}
                <button
                  className="btn primary"
                  onClick={isWebAuthn ? verifyWebAuthn : verifySimulated}
                >
                  {isWebAuthn ? "Verify with passkey (WebAuthn)" : "Verify with simulated passkey"}
                </button>
              </div>
            ) : phase === "verifying" ? (
              <span>
                {isWebAuthn ? "Awaiting authenticator verification…" : "Verifying challenge…"}
              </span>
            ) : phase === "rejected" && flowError ? (
              <div className="rejection">
                {ceremonyInterrupted ? (
                  <>
                    <span className="rejection-title">
                      WebAuthn ceremony did not complete — {flowError.code}
                    </span>
                    <span>{flowError.message}</span>
                    <button
                      className="btn ghost"
                      onClick={() => void runChallenge("PASSKEY", true)}
                    >
                      Use the simulated passkey instead (demo fallback)
                    </button>
                  </>
                ) : (
                  <>
                    <span className="rejection-title">
                      {flowError.code} — blocked by persisted policy
                    </span>
                    <span>{flowError.message}</span>
                  </>
                )}
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      {/* Outcome */}
      <section className="panel-section">
        <div className="section-title">Policy outcome</div>
        {decision.selectedFactor ? (
          <div className="outcome outcome-factor">
            <div className="outcome-icon">✓</div>
            <div className="outcome-body">
              <div className="outcome-title">
                {decision.selectedFactor} selected
              </div>
              <div className="outcome-sub">{decision.action}</div>
              <div className="outcome-actions">
                <button
                  className="btn primary"
                  disabled={busyFactor !== null || phase === "verified"}
                  onClick={() => runChallenge(decision.selectedFactor!)}
                >
                  {phase === "verified"
                    ? "Authorized"
                    : `Continue with ${decision.selectedFactor}`}
                </button>
                {blockedFactor && phase !== "verified" ? (
                  <button
                    className="btn danger-ghost"
                    disabled={busyFactor !== null}
                    onClick={() => runChallenge(blockedFactor.factor)}
                  >
                    Try {blockedFactor.factor} (blocked)
                  </button>
                ) : null}
              </div>
              {verification ? (
                <div className="verification-line">
                  Challenge verified → transaction status:{" "}
                  <strong>{verification}</strong>
                </div>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="outcome outcome-recovery">
            <div className="outcome-icon">!</div>
            <div className="outcome-body">
              <div className="outcome-title">Assisted recovery required</div>
              <div className="outcome-sub">
                No factor survives the policy — the service never falls back to
                an untrusted channel.
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Baseline */}
      {baseline ? (
        <section className="panel-section baseline-section">
          <div className="baseline-label">Fair scalar baseline (risk level only)</div>
          <div className="baseline-requirement">{baseline.requirement}</div>
          <div className="baseline-note">
            A severity-only policy reaches the same high-level requirement for
            equal-risk transactions — it cannot express why a channel is untrusted.
          </div>
        </section>
      ) : null}

      {/* Provenance */}
      <section className="panel-section">
        <div className="section-title">Signal provenance</div>
        <div className="signal-list">
          {record.signals.map((s) => (
            <div key={s.name} className="signal-row">
              <code className="signal-name">{s.name}</code>
              <code className="signal-value">{String(s.value)}</code>
              <span className="signal-source">{s.source}</span>
              {s.synthetic ? <span className="chip chip-sim">synthetic</span> : null}
            </div>
          ))}
        </div>
        <p className="form-note">
          All signals above are synthetic demo data from mock provider adapters —
          the service never claims live integrations.
        </p>
      </section>

      <AuditTimeline events={record.audit} />
      <JsonInspector record={record.decision} />
    </article>
  );
}

function FactorCard({ f }: { f: FactorDecision }) {
  const cls = f.status.toLowerCase();
  return (
    <div className={`factor-card factor-${cls}`}>
      <div className="factor-top">
        <span className="factor-name">{f.factor}</span>
        <span className={`factor-status status-${cls}`}>{f.status}</span>
      </div>
      <code className="factor-reason-code">{f.reasonCode}</code>
      <p className="factor-reason">{f.reason}</p>
      <span className="factor-label">{REASON_DISPLAY[f.reasonCode] ?? f.reasonCode}</span>
    </div>
  );
}

function extractError(err: unknown): { code: string; message: string } {
  if (err instanceof ApiError) {
    return { code: err.code, message: err.message };
  }
  return { code: "UNKNOWN", message: err instanceof Error ? err.message : String(err) };
}
