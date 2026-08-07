/**
 * Decision Core — pure, deterministic decision engines
 * (EXECUTION_new2.md Phase 1).
 *
 * No I/O, no time, no randomness, no framework imports. Every function is a
 * pure function over the frozen contracts in @mfa/contracts. The exit gate:
 * one pure function (`evaluateDecision`) accepts evidence, capabilities, and
 * a policy bundle, and returns threats, trust states, factor evaluations,
 * selection, and the structured trace.
 */
export * from "./normalizeEvidence.js";
export * from "./assessRisk.js";
export * from "./assessThreats.js";
export * from "./assessTrust.js";
export * from "./evaluateFactors.js";
export * from "./selectFactor.js";
export * from "./buildTrace.js";
export * from "./evaluateDecision.js";
export * from "./predicates.js";
export * from "./order.js";
