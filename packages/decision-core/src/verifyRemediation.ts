/**
 * Verified remediation (EXECUTION_new2.md Phase 7).
 *
 * Remediation is never emitted without replay verification. Candidates are
 * derived *from the factor's failed requirements* — never templated promises:
 *
 *   - CAPABILITY failures -> enable the missing capability
 *   - TRUST failures      -> flip the evidence that drove the failing trust
 *                            domain: supporting/conflicting evidence of the
 *                            assessed threat AND the threat's primary-rule
 *                            evidence (e.g. the SIM-change signal itself)
 *   - ASSURANCE failures  -> a policy gate; no evidence/capability candidate
 *                            exists, so the factor is reported accordingly
 *
 * Each candidate is *verified by replay*: the evidence/capability changes are
 * applied to the original decision context, `evaluateDecision` re-runs, and
 * the factor is classified:
 *
 *   VERIFIED_SELECTED       would become eligible AND be selected
 *   VERIFIED_ELIGIBLE       would become eligible (another factor wins)
 *   REMAINS_INELIGIBLE      even with the change, other conditions still fail
 *
 * When no single change verifies, combinations of candidates are searched
 * (multi-condition remediation) and only the minimal verified change sets are
 * returned. Pure and deterministic — the caller supplies the evaluation
 * timestamp so statuses recompute identically to the source decision.
 */
import type {
  CapabilityState,
  EvidenceItem,
  FactorDefinition,
  FactorEvaluation,
  FactorId,
  FactorRemediation,
  PolicyBundle,
  RemediationChangeSet,
  RemediationStatus,
  TrustAssessment,
} from "@mfa/contracts";
import { evaluateDecision } from "./evaluateDecision.js";
import { applyCapabilityOverrides, applyEvidenceOverrides } from "./normalizeEvidence.js";

export interface RemediationContext {
  factorId: FactorId;
  /** The declarative factor definition (for capability requirement ids). */
  factor: FactorDefinition;
  /** The factor's current evaluation — the failed requirements drive candidates. */
  factorEvaluation: FactorEvaluation;
  /** Source decision evidence (the replay base). */
  evidence: EvidenceItem[];
  /** Source decision capabilities (the replay base). */
  capabilities: CapabilityState[];
  /** The immutable policy bundle the decision was made under. */
  policy: PolicyBundle;
  /** Evaluation timestamp of the source decision (deterministic statuses). */
  evaluatedAt: string;
  /** Which factor the source decision selected (for already-eligible factors). */
  selectedFactorId: FactorId | null;
  /** Source trust assessments (primary-rule evidence lookups). */
  trust: TrustAssessment[];
}

/**
 * Derive candidate change sets from the factor's failed requirements.
 * Returns deduplicated, single-change candidates; the verifier builds
 * combinations when no single change verifies.
 */
export function deriveRemediationCandidates(ctx: RemediationContext): RemediationChangeSet[] {
  const raw: RemediationChangeSet[] = [];

  for (const req of ctx.factorEvaluation.failedRequirements) {
    if (req.kind === "CAPABILITY") {
      // Enable the declared capability the factor depends on (no string
      // parsing of requirement ids — the factor definition is the source of
      // truth, and the failed requirement cites its exact id).
      for (const capabilityId of ctx.factor.capabilityRequirements) {
        if (req.requirementId === `${ctx.factorId}__${capabilityId}`) {
          raw.push({
            capabilityChanges: [{ capabilityId: capabilityId as CapabilityState["capabilityId"], available: true }],
          });
        }
      }
    } else if (req.kind === "TRUST") {
      pushTrustCandidates(ctx, req, raw);
    }
    // ASSURANCE failures are policy gates — no evidence/capability candidate.
  }

  const seen = new Set<string>();
  return raw.filter((c) => {
    const key = JSON.stringify(c);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Evidence-flip candidates for a failing trust requirement:
 * 1. every boolean-true evidence referenced by the failing trust domain, and
 * 2. the evidence referenced by the assessed threat's PRIMARY rule (the
 *    headline signal, e.g. RECENT_SIM_CHANGE for SIM_OWNERSHIP).
 */
function pushTrustCandidates(
  ctx: RemediationContext,
  failed: FactorEvaluation["failedRequirements"][number],
  out: RemediationChangeSet[]
): void {
  // 1. Evidence directly referenced by the failing trust domain.
  for (const evidenceId of failed.evidenceIds) {
    const item = ctx.evidence.find((e) => e.id === evidenceId);
    if (item && typeof item.value === "boolean" && item.value === true) {
      out.push({ evidenceChanges: [{ type: item.type, value: false }] });
    }
  }

  // 2. Primary-rule evidence of the threat(s) that drove the failing domain.
  const impacted = ctx.trust.filter((t) => failed.evidenceIds.some((id) => t.evidenceIds.includes(id)));
  const threatIds = new Set(impacted.flatMap((t) => t.threatIds));
  for (const threatId of threatIds) {
    const primaryRules = ctx.policy.threatRules.filter(
      (r) => r.threatId === threatId && r.kind === "PRIMARY"
    );
    for (const rule of primaryRules) {
      const item = ctx.evidence.find(
        (e) => e.type === rule.predicate.evidenceType && typeof e.value === "boolean" && e.value === true
      );
      if (item) {
        out.push({ evidenceChanges: [{ type: item.type, value: false }] });
      }
    }
  }
}

/**
 * Verify every candidate change set by replaying the decision under the
 * changed inputs, then return the minimal verified sets.
 */
export function verifyFactorRemediation(ctx: RemediationContext): FactorRemediation {
  const { factorId } = ctx;

  // A factor that is already eligible has nothing to remediate.
  if (ctx.factorEvaluation.status === "ELIGIBLE") {
    return {
      factorId,
      status: ctx.selectedFactorId === factorId ? "VERIFIED_SELECTED" : "VERIFIED_ELIGIBLE",
      changeSets: [],
      explanationCode: "already_eligible",
    };
  }

  const singles = deriveRemediationCandidates(ctx);
  const attempts: { set: RemediationChangeSet; status: RemediationStatus }[] = [];

  const test = (set: RemediationChangeSet) => {
    const status = classifyChangeSet(ctx, set);
    if (status) attempts.push({ set, status });
  };

  // Single changes first.
  for (const single of singles) test(single);

  // Multi-condition: search combinations (up to triples) when singles fail.
  if (attempts.length === 0 && singles.length >= 2) {
    for (let i = 0; i < singles.length; i += 1) {
      for (let j = i + 1; j < singles.length; j += 1) {
        test(mergeChangeSets(singles[i], singles[j]));
      }
    }
  }
  if (attempts.length === 0 && singles.length >= 3) {
    for (let i = 0; i < singles.length; i += 1) {
      for (let j = i + 1; j < singles.length; j += 1) {
        for (let k = j + 1; k < singles.length; k += 1) {
          test(mergeChangeSets(mergeChangeSets(singles[i], singles[j]), singles[k]));
        }
      }
    }
  }

  if (attempts.length === 0) {
    return {
      factorId,
      status: "REMAINS_INELIGIBLE",
      changeSets: [],
      explanationCode: "remains_ineligible",
    };
  }

  // Prefer the best verified status, then the fewest changes.
  const bestStatus: RemediationStatus = attempts.some((a) => a.status === "VERIFIED_SELECTED")
    ? "VERIFIED_SELECTED"
    : "VERIFIED_ELIGIBLE";

  const bestAttempts = attempts.filter((a) => a.status === bestStatus);
  const minCount = Math.min(...bestAttempts.map((a) => changeCount(a.set)));
  const changeSets = bestAttempts
    .filter((a) => changeCount(a.set) === minCount)
    .map((a) => a.set);

  return {
    factorId,
    status: bestStatus,
    changeSets,
    explanationCode:
      bestStatus === "VERIFIED_SELECTED" ? "would_be_selected" : "would_become_eligible",
  };
}

/** Replay the decision under a candidate change set; classify the factor. */
function classifyChangeSet(
  ctx: RemediationContext,
  changeSet: RemediationChangeSet
): RemediationStatus | null {
  const evidence = applyEvidenceOverrides(
    ctx.evidence,
    changeSet.evidenceChanges ?? [],
    ctx.evaluatedAt
  );
  const capabilities = applyCapabilityOverrides(
    ctx.capabilities,
    changeSet.capabilityChanges ?? []
  );

  const output = evaluateDecision({ evidence, capabilities, policy: ctx.policy });
  if (output.selectedFactorId === ctx.factorId) return "VERIFIED_SELECTED";

  const after = output.factors.find((f) => f.factorId === ctx.factorId);
  return after?.status === "ELIGIBLE" ? "VERIFIED_ELIGIBLE" : null;
}

function mergeChangeSets(a: RemediationChangeSet, b: RemediationChangeSet): RemediationChangeSet {
  return {
    ...(a.capabilityChanges?.length || b.capabilityChanges?.length
      ? { capabilityChanges: [...(a.capabilityChanges ?? []), ...(b.capabilityChanges ?? [])] }
      : {}),
    ...(a.evidenceChanges?.length || b.evidenceChanges?.length
      ? { evidenceChanges: [...(a.evidenceChanges ?? []), ...(b.evidenceChanges ?? [])] }
      : {}),
  };
}

function changeCount(set: RemediationChangeSet): number {
  return (set.capabilityChanges?.length ?? 0) + (set.evidenceChanges?.length ?? 0);
}
