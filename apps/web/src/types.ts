/**
 * Frontend state types. Wire types come from @mfa/contracts; these are
 * UI-level containers that pair a decision with its persisted audit trail.
 */
import type {
  AuditEvent,
  CreateChallengeResponse,
  CreateDecisionResponse,
  VerifyChallengeResponse,
} from "@mfa/contracts";
import type { BaselineResult, StoredSignal } from "./lib/api";

export interface DecisionRecord {
  decision: CreateDecisionResponse;
  audit: AuditEvent[];
  signals: StoredSignal[];
  baseline: BaselineResult | null;
  createdAt: string;
}

export type SlotKey = "left" | "right";

export interface ChallengeFlow {
  slot: SlotKey;
  phase:
    | "idle"
    | "creating"
    | "ready" // challenge created, awaiting user action
    | "verifying"
    | "verified"
    | "rejected"; // policy rejection (the wow-moment proof)
  challenge: CreateChallengeResponse | null;
  verification: VerifyChallengeResponse | null;
  error: { code: string; message: string; details?: unknown } | null;
}

export const IDLE_CHALLENGE: ChallengeFlow = {
  slot: "left",
  phase: "idle",
  challenge: null,
  verification: null,
  error: null,
};

export interface FormState {
  userId: string;
  amountRupees: number;
  payeeIsKnown: boolean;
  deviceId: string;
  deviceTrusted: boolean;
  deviceFirstSeen: boolean;
  sessionId: string;
  ageSeconds: number;
  failedLoginCount: number;
  ipAddress: string;
  asn: string;
  country: string;
  recentSimChange: "true" | "false" | "unknown";
  geoDistance: "unknown" | "near" | "far";
  phishingRelay: boolean;
}
