/**
 * Immutable declarative policy bundles (EXECUTION_new2.md §4.7).
 *
 * Declarative data + validation only: the active demo bundle (v1), structural
 * validation (rejects unknown domain/capability/factor/evidence references),
 * and canonical-serialization content hashing. No engine logic lives here.
 */
export * from "./v1.js";
export * from "./validatePolicy.js";
export * from "./hashPolicy.js";

import type { PolicyBundle } from "@mfa/contracts";
import { withContentHash } from "./hashPolicy.js";
import { CANDIDATE_POLICY_DATA, DEMO_POLICY_DATA } from "./v1.js";

/** The full active demo policy bundle with its computed content hash. */
export const DEMO_POLICY_BUNDLE: PolicyBundle = withContentHash(DEMO_POLICY_DATA);

/** Candidate DRAFT bundle v1.1.0 — one deliberate rule change (Stretch B). */
export const CANDIDATE_POLICY_BUNDLE: PolicyBundle = withContentHash(CANDIDATE_POLICY_DATA);

/** All policy bundle versions the service knows (active v1.0.0 + candidate v1.1.0). */
export const POLICY_BUNDLES: PolicyBundle[] = [DEMO_POLICY_BUNDLE, CANDIDATE_POLICY_BUNDLE];
