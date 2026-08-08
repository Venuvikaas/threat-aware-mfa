/**
 * Frontend state types (EXECUTION_new2.md Phase 5).
 *
 * The decision record IS the full backend response — the entire reasoning
 * graph (evidence, threats, trust, factors, trace) comes from the API and is
 * rendered as-is. The challenge flow tracks the create/verify lifecycle plus
 * the enforcement proof point (POLICY_REJECTION).
 */
import type {
  CreateChallengeResponse,
  DecisionResponse,
  VerifyChallengeResponse,
} from "@mfa/contracts";
import type { DemoUser } from "@mfa/demo-data";

export interface DecisionRecord {
  decision: DecisionResponse;
  createdAt: string;
}

export type SlotKey = "left" | "right";

export type ChallengePhase =
  | "idle"
  | "creating"
  | "ready" // challenge created, awaiting user action
  | "verifying"
  | "verified"
  | "rejected"; // policy rejection or ceremony failure

export interface ChallengeFlow {
  slot: SlotKey;
  factor: string | null;
  phase: ChallengePhase;
  challenge: CreateChallengeResponse | null;
  verification: VerifyChallengeResponse | null;
  error: { code: string; message: string; details?: unknown } | null;
  /** A WEBAUTHN ceremony failed — the labeled simulated fallback is offered. */
  ceremonyInterrupted: boolean;
}

export function idleChallenge(slot: SlotKey): ChallengeFlow {
  return {
    slot,
    factor: null,
    phase: "idle",
    challenge: null,
    verification: null,
    error: null,
    ceremonyInterrupted: false,
  };
}

export interface FormState {
  userId: string;
  amountRupees: number;
  payeeIsKnown: boolean;
  deviceId: string;
  sessionId: string;
  ageSeconds: number;
  failedLoginCount: number;
  ipAddress: string;
  asn: string;
  country: string;
  recentSimChange: "true" | "false" | "unknown";
  phishingRelay: boolean;
  geoDistanceKm: "unknown" | "near" | "far";
}

export type { DemoUser };
