-- Core schema for the Threat-Aware MFA Decision Service (docs/EXECUTION.md PART 4).
-- Applied exactly once by apps/api/src/db/connection.ts (tracked in schema_migrations).

CREATE TABLE users (
  id                 TEXT PRIMARY KEY,
  name               TEXT NOT NULL,
  account_created_at TEXT NOT NULL,
  passkey_enrolled   INTEGER NOT NULL DEFAULT 0,
  created_at         TEXT NOT NULL
);

CREATE TABLE devices (
  id                  TEXT PRIMARY KEY,
  user_id             TEXT NOT NULL REFERENCES users(id),
  trusted             INTEGER NOT NULL DEFAULT 0,
  browser_fingerprint TEXT NOT NULL,
  first_seen_at       TEXT NOT NULL,
  last_seen_at        TEXT NOT NULL
);

CREATE TABLE sessions (
  id                TEXT PRIMARY KEY,
  user_id           TEXT NOT NULL REFERENCES users(id),
  device_id         TEXT REFERENCES devices(id),
  ip_address        TEXT NOT NULL,
  asn               TEXT NOT NULL,
  country           TEXT NOT NULL,
  started_at        TEXT NOT NULL,
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

-- Idempotency for repeated client transaction IDs (docs/EXECUTION.md PART 3).
CREATE UNIQUE INDEX idx_transactions_client_id ON transactions(client_transaction_id);

CREATE TABLE signals (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  transaction_id TEXT NOT NULL REFERENCES transactions(id),
  name           TEXT NOT NULL,
  value_json     TEXT NOT NULL,
  source         TEXT NOT NULL,
  synthetic      INTEGER NOT NULL DEFAULT 1,
  observed_at    TEXT NOT NULL
);

CREATE TABLE decisions (
  id                   TEXT PRIMARY KEY,
  transaction_id       TEXT NOT NULL UNIQUE REFERENCES transactions(id),
  risk_level           TEXT NOT NULL,
  risk_reasons_json    TEXT NOT NULL,
  threat_type          TEXT NOT NULL,
  threat_support       TEXT NOT NULL,
  threat_evidence_json TEXT NOT NULL,
  allowed_factors_json TEXT NOT NULL,
  blocked_factors_json TEXT NOT NULL,
  selected_factor      TEXT,
  action               TEXT NOT NULL,
  policy_version       TEXT NOT NULL,
  created_at           TEXT NOT NULL
);

CREATE TABLE factor_evaluations (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  decision_id TEXT NOT NULL REFERENCES decisions(id),
  factor      TEXT NOT NULL,
  status      TEXT NOT NULL,
  reason_code TEXT NOT NULL,
  reason      TEXT NOT NULL
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

CREATE TABLE audit_events (
  id           TEXT PRIMARY KEY,
  decision_id  TEXT NOT NULL REFERENCES decisions(id),
  event_type   TEXT NOT NULL,
  reason_code  TEXT NOT NULL,
  details_json TEXT NOT NULL DEFAULT '{}',
  created_at   TEXT NOT NULL
);

CREATE INDEX idx_audit_events_decision ON audit_events(decision_id, id);
