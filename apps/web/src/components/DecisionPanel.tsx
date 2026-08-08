/**
 * Live Decision view (EXECUTION_new2.md Phase 5).
 *
 * Renders ONLY what the backend returned: risk, independent threat
 * assessments, trust domain states, factor evaluations, the selected factor
 * or assisted recovery, and the full structured causality trace. The factor
 * inspector and challenge execution sections are composed in below.
 */
import { useEffect, useState } from "react";
import type { DecisionResponse, EvidenceItem, FactorEvaluation } from "@mfa/contracts";
import type { SlotKey } from "../types";
import { api, ApiError } from "../lib/api";
import { CausalityTrace } from "./CausalityTrace";
import { ChallengePanel } from "./ChallengePanel";
import { FactorInspector } from "./FactorInspector";
import { JsonInspector } from "./JsonInspector";
import { ReplayDiffPanel } from "./ReplayDiffPanel";

interface Props {
  decision: DecisionResponse;
  slot: SlotKey;
  onRefresh: () => void | Promise<void>;
}

const THREAT_LABEL: Record<string, string> = {
  SIM_CHANNEL_COMPROMISE: "SIM channel compromise",
  PHISHING_RELAY: "Phishing relay",
  DEVICE_INTEGRITY_CONCERN: "Device integrity concern",
};

const TRUST_LABEL: Record<string, string> = {
  SIM_OWNERSHIP: "SIM ownership",
  TELECOM_DELIVERY: "Telecom delivery",
  DEVICE_INTEGRITY: "Device integrity",
  CREDENTIAL_INTEGRITY: "Credential integrity",
  ORIGIN_BINDING: "Origin binding",
  SESSION_INTEGRITY: "Session integrity",
  USER_VERIFICATION: "User verification",
  KNOWLEDGE_SECRECY: "Knowledge secrecy",
  NETWORK_AVAILABILITY: "Network availability",
};

const EVIDENCE_LABEL: Record<string, string> = {
  RECENT_SIM_CHANGE: "Recent SIM change",
  FIRST_SEEN_DEVICE: "First-seen device",
  NEW_PAYEE: "New payee",
  HIGH_VALUE_TRANSACTION: "High-value transaction",
  PHISHING_RELAY_INDICATOR: "Phishing relay indicator",
  FAILED_LOGIN_BURST: "Failed-login burst",
  GEO_DISTANCE_ANOMALY: "Geo distance anomaly",
  PASSKEY_ENROLLED: "Passkey enrolled",
  WEBAUTHN_SUPPORTED: "WebAuthn supported",
  NETWORK_AVAILABLE: "Network available",
};

function riskClass(level: string): string {
  return level === "HIGH" ? "risk-high" : level === "MEDIUM" ? "risk-medium" : "risk-low";
}

export function DecisionPanel({ decision, slot, onRefresh }: Props) {
  const [inspected, setInspected] = useState<FactorEvaluation | null>(null);

  const selected = decision.factors.find((f) => f.factorId === decision.selectedFactorId);

  return (
    <article className={`decision-panel ${slot === "right" ? "slot-right" : "slot-left"}`}>
      <header className="panel-head">
        <div className="panel-head-main">
          <span className="panel-kicker">Live decision</span>
          <code className="decision-id">{decision.decisionId}</code>
        </div>
        <div className="panel-head-meta">
          <span className="chip">
            policy {decision.policy.version} · {decision.policy.bundleId}
          </span>
          <span className="chip chip-muted">{decision.createdAt}</span>
        </div>
      </header>

      {/* Risk + action */}
      <section className="panel-section">
        <div className="section-row">
          <div className={`risk-badge ${riskClass(decision.risk.level)}`}>
            <span className="risk-label">RISK</span>
            <span className="risk-value">{decision.risk.level}</span>
          </div>
          <div className="risk-detail">
            <div className="reason-list">
              {decision.risk.reasonCodes.length === 0 ? (
                <span className="muted">No risk indicators triggered</span>
              ) : (
                decision.risk.reasonCodes.map((r) => (
                  <span key={r} className="reason-chip">
                    {r}
                  </span>
                ))
              )}
            </div>
            <div className="action-line">
              <span className="action-label">Action</span>
              <strong className={`action action-${decision.action.toLowerCase()}`}>
                {decision.action === "CHALLENGE"
                  ? `Challenge — ${decision.selectedFactorId ?? "factor"}`
                  : "Assisted recovery"}
              </strong>
            </div>
          </div>
        </div>
      </section>

      {/* Threat assessments */}
      <section className="panel-section">
        <div className="section-title">Threat assessments</div>
        {decision.threats.length === 0 ? (
          <p className="muted">No threats assessed.</p>
        ) : (
          <div className="threat-grid">
            {decision.threats.map((t) => (
              <div key={t.threatId} className={`threat-card threat-${t.support.toLowerCase()}`}>
                <div className="threat-top">
                  <span className="threat-name">
                    {THREAT_LABEL[t.threatId] ?? t.threatId}
                  </span>
                  <span className={`threat-support support-${t.support.toLowerCase()}`}>
                    {t.support}
                  </span>
                </div>
                <code className="threat-id">{t.threatId}</code>
                <div className="threat-evidences">
                  {t.supportingEvidenceIds.map((id) => (
                    <span key={id} className="reason-chip evidence">
                      ↑ {id}
                    </span>
                  ))}
                  {t.conflictingEvidenceIds.map((id) => (
                    <span key={id} className="reason-chip conflicting">
                      ↓ {id}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Trust domains */}
      <section className="panel-section">
        <div className="section-title">Trust domains</div>
        <div className="trust-grid">
          {decision.trust.map((t) => (
            <div key={t.domainId} className={`trust-cell trust-${t.state.toLowerCase()}`}>
              <span className="trust-state">{t.state}</span>
              <span className="trust-domain">{TRUST_LABEL[t.domainId] ?? t.domainId}</span>
              <code className="trust-id">{t.domainId}</code>
            </div>
          ))}
        </div>
      </section>

      {/* Factor inspector */}
      <FactorInspector factors={decision.factors} onInspect={setInspected} />
      {inspected ? (
        <InspectedDetail
          decisionId={decision.decisionId}
          factor={inspected}
          evidence={decision.evidence}
          onClose={() => setInspected(null)}
        />
      ) : null}

      {/* Challenge execution + enforcement */}
      <ChallengePanel
        decisionId={decision.decisionId}
        factors={decision.factors}
        selectedFactorId={decision.selectedFactorId}
        action={decision.action}
        onOutcome={onRefresh}
      />

      {/* Evidence provenance */}
      <section className="panel-section">
        <div className="section-title">Evidence provenance</div>
        <div className="evidence-list">
          {decision.evidence.map((e) => (
            <EvidenceRow key={e.id} e={e} />
          ))}
        </div>
        <p className="form-note">
          All evidence is synthetic demo data from mock provider adapters — the
          service never claims live integrations. Status is derived from the
          validity window, not invented.
        </p>
      </section>

      {/* Replay & diff */}
      <ReplayDiffPanel decision={decision} />

      {/* Causality trace */}
      <CausalityTrace events={decision.trace} />

      <JsonInspector record={decision} />

      {selected ? (
        <div className="outcome-strip">
          <span className="outcome-icon">✓</span>
          <span>
            Selected factor <strong>{selected.factorId}</strong> — assurance{" "}
            {selected.assuranceSatisfied ? "satisfied" : "below"}, friction{" "}
            {selected.frictionTier}
          </span>
        </div>
      ) : null}
    </article>
  );
}

function EvidenceRow({ e }: { e: EvidenceItem }) {
  const value = e.value === null ? "null" : typeof e.value === "string" ? e.value : String(e.value);
  return (
    <div className="evidence-row">
      <span className={`ev-status ev-${e.status.toLowerCase()}`}>{e.status}</span>
      <div className="evidence-main">
        <div className="evidence-name">
          {EVIDENCE_LABEL[e.type] ?? e.type}
          <code className="evidence-type">{e.type}</code>
        </div>
        <code className="evidence-value">{value}</code>
      </div>
      <div className="evidence-meta">
        <span className="evidence-provider">
          {e.providerId} · {e.providerType}
        </span>
        {e.synthetic ? <span className="chip chip-sim">synthetic</span> : null}
        <span className="chip chip-muted">{e.quality}</span>
      </div>
    </div>
  );
}

function InspectedDetail({
  decisionId,
  factor,
  evidence,
  onClose,
}: {
  decisionId: string;
  factor: FactorEvaluation;
  evidence: EvidenceItem[];
  onClose: () => void;
}) {
  const byId = new Map(evidence.map((e) => [e.id, e]));
  return (
    <>
      <RemediationBox decisionId={decisionId} factor={factor} />
      <InspectedBody factor={factor} byId={byId} onClose={onClose} />
    </>
  );
}

function RemediationBox({ decisionId, factor }: { decisionId: string; factor: FactorEvaluation }) {
  const [remediation, setRemediation] = useState<null | {
    verified: boolean;
    wouldBecomeEligible: boolean;
    wouldBeSelected: boolean;
    changeSets: { capabilityChanges?: { capabilityId: string; available: boolean }[]; evidenceChanges?: { type: string; value: unknown }[] }[];
    error?: string;
  }>(null);

  useEffect(() => {
    let cancelled = false;
    setRemediation(null);
    if (factor.status === "ELIGIBLE" || factor.failedRequirements.length === 0) {
      return;
    }
    api
      .verifyRemediation(decisionId, factor.factorId)
      .then((r) => {
        if (!cancelled) setRemediation(r);
      })
      .catch((err) => {
        if (!cancelled) {
          setRemediation({
            verified: false,
            wouldBecomeEligible: false,
            wouldBeSelected: false,
            changeSets: [],
            error: err instanceof ApiError ? err.message : "Remediation check failed",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [decisionId, factor.factorId, factor.status, factor.failedRequirements]);

  if (remediation === null) return null;

  return (
    <div className="inspected-remediation">
      <div className="remediation-head">
        <span className="remediation-icon">↻</span>
        <span>Verified remediation</span>
        {remediation.error ? (
          <span className="chip chip-muted">replay unavailable</span>
        ) : (
          <span className={`chip ${remediation.wouldBeSelected ? "chip-ok" : remediation.wouldBecomeEligible ? "chip-diff" : "chip-muted"}`}>
            {remediation.wouldBeSelected
              ? "would be selected"
              : remediation.wouldBecomeEligible
                ? "would become eligible"
                : "remains ineligible"}
          </span>
        )}
      </div>
      {remediation.error ? (
        <p className="muted">{remediation.error}</p>
      ) : remediation.changeSets.length === 0 ? (
        <p className="muted">
          No change to evidence or capabilities was verified to make this
          factor eligible — other conditions still fail.
        </p>
      ) : (
        <ul className="remediation-sets">
          {remediation.changeSets.map((set, i) => (
            <li key={i} className="remediation-set">
              {set.capabilityChanges?.length ? (
                <span className="remediation-change">
                  {set.capabilityChanges.map((c) => (
                    <code key={c.capabilityId}>
                      {c.capabilityId} → {c.available ? "available" : "unavailable"}
                    </code>
                  ))}
                </span>
              ) : null}
              {set.evidenceChanges?.length ? (
                <span className="remediation-change">
                  {set.evidenceChanges.map((c) => (
                    <code key={c.type}>
                      {c.type} → {String(c.value)}
                    </code>
                  ))}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function InspectedBody({
  factor,
  byId,
  onClose,
}: {
  factor: FactorEvaluation;
  byId: Map<string, EvidenceItem>;
  onClose: () => void;
}) {
  return (
    <div className="inspected-detail" role="dialog" aria-label={`${factor.factorId} detail`}>
      <div className="inspected-head">
        <span className="panel-kicker">Factor detail — {factor.factorId}</span>
        <button className="btn ghost small" onClick={onClose} type="button">
          Close
        </button>
      </div>
      <div className="inspected-failed">
        {factor.failedRequirements.length === 0 ? (
          <p className="muted">
            No failed requirements — this factor passed every declared gate.
          </p>
        ) : (
          factor.failedRequirements.map((r) => (
            <div key={r.requirementId} className="inspected-req">
              <code>{r.requirementId}</code>
              <span>
                required <strong>{r.requiredState}</strong> · actual{" "}
                <strong className="actual">{r.actualState}</strong>
              </span>
              <code className="trace-code">{r.reasonCode}</code>
              <div className="inspected-req-refs">
                {r.evidenceIds.map((id) => (
                  <span key={id} className="req-ref">
                    <code>{id}</code>{" "}
                    {byId.has(id) ? (
                      <span className="muted">{EVIDENCE_LABEL[byId.get(id)!.type] ?? byId.get(id)!.type}</span>
                    ) : null}
                  </span>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
