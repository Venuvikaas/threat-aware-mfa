-- Core schema for the Threat-Aware Authentication Decision Service
-- (EXECUTION_new2.md §6). Supersedes the earlier compatibility-engine schema.
-- Applied exactly once by apps/api/src/db/connection.ts (tracked in
-- schema_migrations). Foreign keys are enabled on every connection.
--
-- Persistence rules enforced here:
--   - Decision creation is atomic (the service wraps inserts in a transaction).
--   - Trace events are append-only.
--   - Replays never mutate original decisions; replay records link to source.
--   - No OTP values, private keys, or real customer data are ever stored.

CREATE TABLE users (
  id                 TEXT PRIMARY KEY,
  name               TEXT NOT NULL,
  account_created_at TEXT NOT NULL,
  created_at         TEXT NOT NULL
);

CREATE TABLE devices (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id),
  trusted       INTEGER NOT NULL DEFAULT 0,
  first_seen_at TEXT NOT NULL,
  last_seen_at  TEXT NOT NULL
);

CREATE TABLE sessions (
  id                 TEXT PRIMARY KEY,
  user_id            TEXT NOT NULL REFERENCES users(id),
  device_id          TEXT REFERENCES devices(id),
  ip_address         TEXT NOT NULL,
  asn                TEXT NOT NULL,
  country            TEXT NOT NULL,
  started_at         TEXT NOT NULL,
  failed_login_count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE transactions (
  id                   TEXT PRIMARY KEY,
  client_transaction_id TEXT NOT NULL UNIQUE,
  user_id              TEXT NOT NULL REFERENCES users(id),
  amount_minor         INTEGER NOT NULL,
  currency             TEXT NOT NULL DEFAULT 'INR',
  payee_id             TEXT NOT NULL,
  payee_is_known       INTEGER NOT NULL DEFAULT 0,
  status               TEXT NOT NULL DEFAULT 'PENDING',
  created_at           TEXT NOT NULL
);

CREATE UNIQUE INDEX idx_transactions_client_id ON transactions(client_transaction_id);

-- User/device capabilities (seeded from demo-data profiles; the capability
-- gate is separate from threat incompatibility).
CREATE TABLE user_capabilities (
  user_id       TEXT NOT NULL REFERENCES users(id),
  capability_id TEXT NOT NULL,
  available     INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, capability_id)
);

-- Immutable policy bundles: every decision references bundle id, version, and
-- content hash; the hash is verified when a bundle is loaded.
CREATE TABLE policy_bundles (
  id            TEXT PRIMARY KEY,
  version       TEXT NOT NULL,
  content_hash  TEXT NOT NULL,
  status        TEXT NOT NULL,
  rules_json    TEXT NOT NULL,
  created_at    TEXT NOT NULL
);

CREATE TABLE policy_rules (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  bundle_id  TEXT NOT NULL REFERENCES policy_bundles(id),
  rule_type  TEXT NOT NULL,   -- RISK | THREAT | TRUST_IMPACT
  rule_id    TEXT NOT NULL,
  rule_json  TEXT NOT NULL
);

CREATE TABLE decisions (
  id                  TEXT PRIMARY KEY,
  transaction_id      TEXT NOT NULL UNIQUE REFERENCES transactions(id),
  policy_bundle_id    TEXT NOT NULL REFERENCES policy_bundles(id),
  policy_version      TEXT NOT NULL,
  content_hash        TEXT NOT NULL,
  risk_level          TEXT NOT NULL,
  risk_reason_codes_json TEXT NOT NULL DEFAULT '[]',
  action              TEXT NOT NULL,
  selected_factor_id  TEXT,
  created_at          TEXT NOT NULL
);

-- Evidence bound to a decision, preserving full provenance.
CREATE TABLE evidence_items (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  decision_id   TEXT NOT NULL REFERENCES decisions(id),
  evidence_id   TEXT NOT NULL,          -- engine id, e.g. ev_0
  type          TEXT NOT NULL,
  value_json    TEXT NOT NULL,
  provider_id   TEXT NOT NULL,
  provider_type TEXT NOT NULL,
  observed_at   TEXT NOT NULL,
  valid_until   TEXT,
  synthetic     INTEGER NOT NULL DEFAULT 1,
  quality       TEXT NOT NULL,
  status        TEXT NOT NULL
);

CREATE TABLE threat_assessments (
  id                        INTEGER PRIMARY KEY AUTOINCREMENT,
  decision_id               TEXT NOT NULL REFERENCES decisions(id),
  threat_id                 TEXT NOT NULL,
  support                   TEXT NOT NULL,
  supporting_evidence_json  TEXT NOT NULL DEFAULT '[]',
  conflicting_evidence_json TEXT NOT NULL DEFAULT '[]',
  activated_rule_ids_json   TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE trust_assessments (
  id                     INTEGER PRIMARY KEY AUTOINCREMENT,
  decision_id            TEXT NOT NULL REFERENCES decisions(id),
  domain_id              TEXT NOT NULL,
  state                  TEXT NOT NULL,
  evidence_ids_json      TEXT NOT NULL DEFAULT '[]',
  threat_ids_json        TEXT NOT NULL DEFAULT '[]',
  activated_rule_ids_json TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE factor_evaluations (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  decision_id          TEXT NOT NULL REFERENCES decisions(id),
  factor_id            TEXT NOT NULL,
  status               TEXT NOT NULL,
  assurance_satisfied  INTEGER NOT NULL DEFAULT 0,
  friction_tier        TEXT NOT NULL,
  trace_event_ids_json TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE failed_requirements (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  decision_id     TEXT NOT NULL REFERENCES decisions(id),
  factor_id       TEXT NOT NULL,
  kind            TEXT NOT NULL,
  requirement_id  TEXT NOT NULL,
  actual_state    TEXT NOT NULL,
  required_state  TEXT NOT NULL,
  evidence_ids_json TEXT NOT NULL DEFAULT '[]',
  rule_ids_json   TEXT NOT NULL DEFAULT '[]',
  reason_code     TEXT NOT NULL
);

-- Append-only structured causality trace.
CREATE TABLE trace_events (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  decision_id      TEXT NOT NULL REFERENCES decisions(id),
  event_id         TEXT NOT NULL,       -- engine id, e.g. tr_0
  phase            TEXT NOT NULL,
  rule_id          TEXT NOT NULL,
  rule_version     TEXT NOT NULL,
  input_refs_json  TEXT NOT NULL DEFAULT '[]',
  output_refs_json TEXT NOT NULL DEFAULT '[]',
  explanation_code TEXT NOT NULL,
  sequence         INTEGER NOT NULL,
  UNIQUE (decision_id, event_id)
);

CREATE TABLE challenges (
  id                 TEXT PRIMARY KEY,
  decision_id        TEXT NOT NULL REFERENCES decisions(id),
  factor             TEXT NOT NULL,
  mode               TEXT NOT NULL,
  challenge_data_json TEXT,
  expires_at         TEXT NOT NULL,
  consumed_at        TEXT,
  verified           INTEGER NOT NULL DEFAULT 0,
  created_at         TEXT NOT NULL
);

-- Replay lineage: replays link to immutable source decisions and never mutate
-- the original.
CREATE TABLE replays (
  id                  TEXT PRIMARY KEY,
  source_decision_id  TEXT NOT NULL REFERENCES decisions(id),
  mode                TEXT NOT NULL,    -- EXACT | FORK
  policy_version      TEXT NOT NULL,
  produced_decision_id TEXT NOT NULL REFERENCES decisions(id),
  created_at          TEXT NOT NULL
);

CREATE TABLE replay_changes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  replay_id   TEXT NOT NULL REFERENCES replays(id),
  kind        TEXT NOT NULL,            -- EVIDENCE | CAPABILITY
  ref         TEXT NOT NULL,            -- evidence type or capability id
  before_json TEXT,
  after_json  TEXT
);

CREATE TABLE decision_diffs (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  replay_id           TEXT NOT NULL REFERENCES replays(id),
  source_decision_id  TEXT NOT NULL REFERENCES decisions(id),
  identical           INTEGER NOT NULL DEFAULT 0,
  sections_json       TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE verified_remediations (
  id               TEXT PRIMARY KEY,
  decision_id      TEXT NOT NULL REFERENCES decisions(id),
  factor_id        TEXT NOT NULL,
  status           TEXT NOT NULL,       -- VERIFIED_ELIGIBLE | VERIFIED_SELECTED | REMAINS_INELIGIBLE
  change_sets_json TEXT NOT NULL DEFAULT '[]',
  explanation_code TEXT NOT NULL,
  created_at       TEXT NOT NULL
);

CREATE INDEX idx_evidence_items_decision ON evidence_items(decision_id);
CREATE INDEX idx_threats_decision ON threat_assessments(decision_id);
CREATE INDEX idx_trust_decision ON trust_assessments(decision_id);
CREATE INDEX idx_factor_evals_decision ON factor_evaluations(decision_id);
CREATE INDEX idx_failed_reqs_decision ON failed_requirements(decision_id);
CREATE INDEX idx_trace_decision ON trace_events(decision_id, sequence);
CREATE INDEX idx_challenges_decision ON challenges(decision_id);
CREATE INDEX idx_replays_source ON replays(source_decision_id);
