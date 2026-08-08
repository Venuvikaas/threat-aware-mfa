/**
 * Semantic decision comparison (EXECUTION_new2.md Phase 6).
 *
 * Compares two decisions at the semantic level — what changed in the
 * reasoning, never the generated identifiers or timestamps. Sections:
 *
 *   INPUT     normalized evidence (value/status/provenance)
 *   THREAT    independent threat assessments
 *   TRUST     ordinal trust-domain states
 *   FACTOR    factor eligibility + failed requirements
 *   RULE      activated rule trace
 *   SELECTION selection, risk, and final action
 *
 * Exact replay must produce an empty diff (identical = true); fork replay
 * changes only declared inputs and surfaces the derived-state deltas here.
 * The function is pure: it takes two decision responses and returns the
 * structured sections consumed by the diff endpoint, UI, and tests.
 */
import type {
  DecisionDiff,
  DecisionResponse,
  DiffChange,
  DiffSection,
  EvidenceItem,
  FactorEvaluation,
  PolicyBundle,
  RuleTraceEvent,
  ThreatAssessment,
  TracePhase,
  TrustAssessment,
} from "@mfa/contracts";

/** Evidence fields that carry decision semantics (excludes id and timestamps). */
function evidenceKey(e: EvidenceItem): string {
  return JSON.stringify({
    type: e.type,
    value: e.value,
    status: e.status,
    synthetic: e.synthetic,
    quality: e.quality,
    providerId: e.providerId,
    providerType: e.providerType,
  });
}

function threatKey(t: ThreatAssessment): string {
  return JSON.stringify({
    threatId: t.threatId,
    support: t.support,
    supportingEvidenceIds: [...t.supportingEvidenceIds].sort(),
    conflictingEvidenceIds: [...t.conflictingEvidenceIds].sort(),
    activatedRuleIds: [...t.activatedRuleIds].sort(),
  });
}

function trustKey(t: TrustAssessment): string {
  return JSON.stringify({
    domainId: t.domainId,
    state: t.state,
    evidenceIds: [...t.evidenceIds].sort(),
    threatIds: [...t.threatIds].sort(),
    activatedRuleIds: [...t.activatedRuleIds].sort(),
  });
}

function factorKey(f: FactorEvaluation): string {
  return JSON.stringify({
    factorId: f.factorId,
    status: f.status,
    assuranceSatisfied: f.assuranceSatisfied,
    frictionTier: f.frictionTier,
    failedRequirements: f.failedRequirements.map((r) => ({
      kind: r.kind,
      requirementId: r.requirementId,
      actualState: r.actualState,
      requiredState: r.requiredState,
      reasonCode: r.reasonCode,
      evidenceIds: [...r.evidenceIds].sort(),
      ruleIds: [...r.ruleIds].sort(),
    })),
  });
}

function traceKey(e: RuleTraceEvent): string {
  return JSON.stringify({
    ruleId: e.ruleId,
    phase: e.phase,
    explanationCode: e.explanationCode,
    inputRefs: [...e.inputRefs].sort(),
    outputRefs: [...e.outputRefs].sort(),
  });
}

/**
 * Phases produced by the pure decision engine. CHALLENGE/OUTCOME events are
 * appended by the challenge lifecycle (audit) and can never be reproduced by
 * an exact replay — so they are excluded from the deterministic RULE diff.
 */
const DECISION_TRACE_PHASES: TracePhase[] = [
  "EVIDENCE_NORMALIZATION",
  "THREAT_ASSESSMENT",
  "TRUST_ASSESSMENT",
  "FACTOR_ELIGIBILITY",
  "SELECTION",
];

function decisionTrace(events: RuleTraceEvent[]): RuleTraceEvent[] {
  return events.filter((e) => DECISION_TRACE_PHASES.includes(e.phase));
}

function selectionKey(d: DecisionResponse): string {
  return JSON.stringify({
    level: d.risk.level,
    reasonCodes: [...d.risk.reasonCodes].sort(),
    selectedFactorId: d.selectedFactorId,
    action: d.action,
  });
}

function compareList<T>(
  before: T[],
  after: T[],
  key: (item: T) => string,
  pathPrefix: string,
  changes: DiffChange[]
): void {
  const beforeKeyed = new Map(before.map((item) => [key(item), item]));
  const afterKeyed = new Map(after.map((item) => [key(item), item]));
  const seen = new Set<string>();

  for (const [k, beforeItem] of beforeKeyed) {
    seen.add(k);
    const afterItem = afterKeyed.get(k);
    if (!afterItem) {
      changes.push({ path: `${pathPrefix}.${labelFor(key(beforeItem))}`, before: beforeItem, after: undefined });
    }
  }
  for (const [k, afterItem] of afterKeyed) {
    if (seen.has(k)) continue;
    changes.push({ path: `${pathPrefix}.${labelFor(key(afterItem))}`, before: undefined, after: afterItem });
  }
}

/** Human-ish label for a diffed item (its identifying field when available). */
function labelFor(rawKey: string): string {
  try {
    const parsed = JSON.parse(rawKey) as Record<string, unknown>;
    return String(parsed.type ?? parsed.threatId ?? parsed.domainId ?? parsed.factorId ?? parsed.ruleId ?? "item");
  } catch {
    return "item";
  }
}

/**
 * Compare two decisions and return the non-empty diff sections.
 * Returns an empty array when the decisions are semantically identical.
 */
export function diffDecisions(source: DecisionResponse, produced: DecisionResponse): DecisionDiff["sections"] {
  const sections: DecisionDiff["sections"] = [];

  const inputChanges: DiffChange[] = [];
  compareList(source.evidence, produced.evidence, evidenceKey, "evidence", inputChanges);
  if (inputChanges.length > 0) sections.push({ section: "INPUT", changes: inputChanges });

  const threatChanges: DiffChange[] = [];
  compareList(source.threats, produced.threats, threatKey, "threats", threatChanges);
  if (threatChanges.length > 0) sections.push({ section: "THREAT", changes: threatChanges });

  const trustChanges: DiffChange[] = [];
  compareList(source.trust, produced.trust, trustKey, "trust", trustChanges);
  if (trustChanges.length > 0) sections.push({ section: "TRUST", changes: trustChanges });

  const factorChanges: DiffChange[] = [];
  compareList(source.factors, produced.factors, factorKey, "factors", factorChanges);
  if (factorChanges.length > 0) sections.push({ section: "FACTOR", changes: factorChanges });

  const ruleChanges: DiffChange[] = [];
  compareList(decisionTrace(source.trace), decisionTrace(produced.trace), traceKey, "rules", ruleChanges);
  if (ruleChanges.length > 0) sections.push({ section: "RULE", changes: ruleChanges });

  const selectionChanges: DiffChange[] = [];
  if (selectionKey(source) !== selectionKey(produced)) {
    const before: Record<string, unknown> = {
      level: source.risk.level,
      reasonCodes: [...source.risk.reasonCodes].sort(),
      selectedFactorId: source.selectedFactorId,
      action: source.action,
    };
    const after: Record<string, unknown> = {
      level: produced.risk.level,
      reasonCodes: [...produced.risk.reasonCodes].sort(),
      selectedFactorId: produced.selectedFactorId,
      action: produced.action,
    };
    selectionChanges.push({ path: "selection", before, after });
  }
  if (selectionChanges.length > 0) sections.push({ section: "SELECTION", changes: selectionChanges });

  return sections;
}

/**
 * Compare two policy bundles at the rule level (Stretch B).
 *
 * Only policy content is compared — version, status, hash, declarative rule
 * lists, and selection policy. Inputs are never involved, so policy deltas
 * can never be mislabeled as input changes.
 */
export function diffPolicies(source: PolicyBundle, produced: PolicyBundle): DiffChange[] {
  const changes: DiffChange[] = [];

  if (source.version !== produced.version) {
    changes.push({ path: "policy.version", before: source.version, after: produced.version });
  }
  if (source.status !== produced.status) {
    changes.push({ path: "policy.status", before: source.status, after: produced.status });
  }
  if (source.contentHash !== produced.contentHash) {
    changes.push({ path: "policy.contentHash", before: source.contentHash, after: produced.contentHash });
  }

  comparePolicyRules(source.riskRules, produced.riskRules, "policy.riskRules", changes);
  comparePolicyRules(source.threatRules, produced.threatRules, "policy.threatRules", changes);
  comparePolicyRules(source.trustImpactRules, produced.trustImpactRules, "policy.trustImpactRules", changes);
  comparePolicyRules(source.factorDefinitions, produced.factorDefinitions, "policy.factorDefinitions", changes);

  if (JSON.stringify(source.selectionPolicy) !== JSON.stringify(produced.selectionPolicy)) {
    changes.push({ path: "policy.selectionPolicy", before: source.selectionPolicy, after: produced.selectionPolicy });
  }

  return changes;
}

/** Compare declarative rule lists by id: added, removed, or changed entries. */
function comparePolicyRules<T extends { id: string }>(
  before: T[],
  after: T[],
  pathPrefix: string,
  changes: DiffChange[]
): void {
  const beforeById = new Map(before.map((r) => [r.id, r]));
  const afterById = new Map(after.map((r) => [r.id, r]));
  const ids = new Set([...beforeById.keys(), ...afterById.keys()]);
  for (const id of ids) {
    const beforeRule = beforeById.get(id);
    const afterRule = afterById.get(id);
    if (!afterRule) {
      changes.push({ path: `${pathPrefix}.${id}`, before: beforeRule, after: undefined });
    } else if (!beforeRule) {
      changes.push({ path: `${pathPrefix}.${id}`, before: undefined, after: afterRule });
    } else if (JSON.stringify(beforeRule) !== JSON.stringify(afterRule)) {
      changes.push({ path: `${pathPrefix}.${id}`, before: beforeRule, after: afterRule });
    }
  }
}

/** Convenience: build a full DecisionDiff record from a replay id + two decisions. */
export function buildDecisionDiff(
  replayId: string,
  sourceDecisionId: string,
  source: DecisionResponse,
  produced: DecisionResponse,
  sourcePolicy?: PolicyBundle,
  producedPolicy?: PolicyBundle
): DecisionDiff {
  const sections = diffDecisions(source, produced);
  // Stretch B: rule-level policy deltas are a separate section, never merged
  // into input/derived changes. Same bundle => empty (exact replay stays
  // identical); different bundle => the actual added/removed/changed rules.
  if (sourcePolicy && producedPolicy) {
    const policyChanges = diffPolicies(sourcePolicy, producedPolicy);
    if (policyChanges.length > 0) {
      sections.unshift({ section: "POLICY", changes: policyChanges });
    }
  }
  return {
    replayId,
    sourceDecisionId,
    identical: sections.length === 0,
    sections,
  };
}

export type { DiffSection };
