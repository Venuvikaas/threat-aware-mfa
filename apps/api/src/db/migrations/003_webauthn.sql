-- WebAuthn credential + ceremony storage (docs/EXECUTION_new.md Phase 7).
-- Stores public credential data only — never private keys or secrets.

-- Public credential material returned by a successful WebAuthn registration.
-- `id` and `public_key` are base64url-encoded public data.
CREATE TABLE passkey_credentials (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id),
  public_key  TEXT NOT NULL,
  counter     INTEGER NOT NULL,
  transports  TEXT NOT NULL DEFAULT '[]',
  device_type TEXT,
  backed_up   INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL,
  UNIQUE (user_id, id)
);

-- Pending registration ceremonies: the server-side challenge state that must
-- be consumed exactly once before expiry (bound to a user, not a decision).
CREATE TABLE passkey_registrations (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES users(id),
  challenge       TEXT NOT NULL,
  expected_origin TEXT NOT NULL,
  rp_id           TEXT NOT NULL,
  expires_at      TEXT NOT NULL,
  consumed_at     TEXT,
  created_at      TEXT NOT NULL
);

CREATE INDEX idx_passkey_credentials_user ON passkey_credentials(user_id);
CREATE INDEX idx_passkey_registrations_user ON passkey_registrations(user_id);
