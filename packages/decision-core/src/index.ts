/**
 * Threat-Aware MFA Decision Core — pure, deterministic decision engines.
 *
 * No I/O, no time, no randomness. Every function is a pure function over the
 * frozen contracts in @mfa/contracts (docs/EXECUTION.md Phase 2 exit gate).
 */
export * from "./policy.js";
export * from "./riskEngine.js";
export * from "./threatEngine.js";
export * from "./factorRegistry.js";
export * from "./policyEngine.js";
export * from "./scalarBaseline.js";
