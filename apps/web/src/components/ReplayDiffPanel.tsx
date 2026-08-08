/**
 * Replay & Diff view (EXECUTION_new2.md Phase 6/9).
 *
 * Replays a persisted decision through the backend without mutating it:
 *
 *   - "Exact replay" proves determinism — the produced decision is
 *     semantically identical (empty diff).
 *   - "Fork: passkey enrolled → false" is the judge demo fork — the threat
 *     and SIM trust states stay unchanged, passkey becomes UNAVAILABLE, and
 *     the outcome becomes assisted recovery.
 *   - "Fork: passkey enrolled → true" demonstrates the verified remediation
 *     path (passkey becomes eligible and selected).
 *
 * The structured diff is fetched from the API and rendered by section with
 * before → after changes. All product behavior comes from API responses.
 */
import { useState } from "react";
import type { CapabilityId, DecisionDiff, DecisionResponse } from "@mfa/contracts";
import { api, ApiError } from "../lib/api";

interface Props {
  decision: DecisionResponse;
}

const SECTION_LABEL: Record<string, string> = {
  INPUT: "Input (evidence)",
  THREAT: "Threat assessments",
  TRUST: "Trust domains",
  FACTOR: "Factor eligibility",
  RULE: "Activated rules",
  SELECTION: "Selection & outcome",
  POLICY: "Policy rules (bundle diff)",
};

function renderDiffValue(value: unknown): string {
  if (value === undefined) return "—";
  if (value !== null && typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/**
 * Demo candidate bundle for policy-version replay (Stretch B). Kept local:
 * the web client cannot import @mfa/policy-bundles (it runs node:crypto
 * hashing at module scope, which is server-only).
 */
const CANDIDATE_POLICY_VERSION = "1.1.0";


export function ReplayDiffPanel({ decision }: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const [diff, setDiff] = useState<DecisionDiff | null>(null);
  const [replayMeta, setReplayMeta] = useState<{ replayId: string; mode: string; producedDecisionId: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [policyVersion, setPolicyVersion] = useState<string>(decision.policy.version);

  async function run(mode: "EXACT" | "FORK", label: string, fork?: { capabilityId: CapabilityId; available: boolean }) {
    setBusy(label);
    setError(null);
    try {
      const record = await api.createReplay(decision.decisionId, {
        mode,
        ...(fork ? { capabilityChanges: [fork] } : {}),
        ...(policyVersion !== decision.policy.version ? { policyVersion } : {}),
      });
      const result = await api.getReplayDiff(record.replayId);
      setDiff(result);
      setReplayMeta({
        replayId: record.replayId,
        mode: record.mode,
        producedDecisionId: record.producedDecisionId,
      });
    } catch (err) {
      setDiff(null);
      setReplayMeta(null);
      setError(err instanceof ApiError ? `${err.code}: ${err.message}` : "Replay failed");
    } finally {
      setBusy(null);
    }
  }

  const passkeyEnrolled =
    decision.evidence.find((e) => e.type === "PASSKEY_ENROLLED")?.value === true ||
    decision.factors.find((f) => f.factorId === "PASSKEY")?.status === "ELIGIBLE";

  return (
    <section className="panel-section replay-section">
      <div className="section-head-row">
        <div className="section-title">
          Replay &amp; diff
          <span className="chip chip-muted">counterfactuals on a persisted decision</span>
        </div>
      </div>

      <p className="panel-note">
        Replays re-run the backend engine over the original normalized evidence
        and never mutate the source decision. Exact replay is the determinism
        proof; the passkey fork shows what changes when a capability flips.
      </p>

      <div className="replay-actions">
        <label className="policy-version-field" title="Replay under a different immutable policy bundle">
          <span className="muted">policy</span>
          <select
            value={policyVersion}
            disabled={busy !== null}
            onChange={(e) => setPolicyVersion(e.target.value)}
          >
            <option value={decision.policy.version}>{decision.policy.version} (source)</option>
            <option value={CANDIDATE_POLICY_VERSION}>{CANDIDATE_POLICY_VERSION} (candidate)</option>
          </select>
        </label>
        <button
          className="btn ghost small"
          type="button"
          disabled={busy !== null}
          onClick={() => void run("EXACT", "Exact replay")}
        >
          {busy === "Exact replay" ? "Replaying…" : "Exact replay"}
        </button>
        <button
          className="btn ghost small"
          type="button"
          disabled={busy !== null || !passkeyEnrolled}
          title={passkeyEnrolled ? "Passkey enrolled → not enrolled" : "Passkey is not enrolled in this decision"}
          onClick={() => void run("FORK", "Fork passkey off", { capabilityId: "PASSKEY_ENROLLED", available: false })}
        >
          {busy === "Fork passkey off" ? "Forking…" : "Fork: passkey → off"}
        </button>
        <button
          className="btn ghost small"
          type="button"
          disabled={busy !== null || passkeyEnrolled}
          title={!passkeyEnrolled ? "Passkey not enrolled → enrolled" : "Passkey is already enrolled in this decision"}
          onClick={() => void run("FORK", "Fork passkey on", { capabilityId: "PASSKEY_ENROLLED", available: true })}
        >
          {busy === "Fork passkey on" ? "Forking…" : "Fork: passkey → on"}
        </button>
      </div>

      {error ? (
        <div className="flow-banner flow-rejected">
          <span className="rejection-icon">⊘</span>
          <p className="rejection-message">{error}</p>
        </div>
      ) : null}

      {replayMeta && diff ? (
        <div className="replay-result">
          <div className="replay-meta">
            <span className={`chip ${diff.identical ? "chip-ok" : "chip-diff"}`}>
              {diff.identical ? "IDENTICAL — determinism proven" : "CHANGED"}
            </span>
            <code className="challenge-id">{replayMeta.replayId}</code>
            <span className="muted">
              produced <code>{replayMeta.producedDecisionId}</code>
            </span>
          </div>

          {diff.identical ? (
            <p className="muted">
              Exact replay reproduced every threat, trust state, factor
              evaluation, rule, and selection — only generated ids and
              timestamps differ.
            </p>
          ) : (
            <div className="diff-sections">
              {diff.sections.map((s) => (
                <div key={s.section} className="diff-section">
                  <div className="diff-section-head">
                    <span className="diff-section-label">
                      {SECTION_LABEL[s.section] ?? s.section}
                    </span>
                    <span className="chip chip-muted">{s.changes.length} change{s.changes.length === 1 ? "" : "s"}</span>
                  </div>
                  <ul className="diff-changes">
                    {s.changes.map((c, i) => (
                      <li key={i} className="diff-change">
                        <code className="diff-path">{c.path}</code>
                        <div className="diff-values">
                          {c.before !== undefined ? (
                            <span className="diff-before">before: {renderDiffValue(c.before)}</span>
                          ) : null}
                          {c.after !== undefined ? (
                            <span className="diff-after">after: {renderDiffValue(c.after)}</span>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
