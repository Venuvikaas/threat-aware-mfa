-- Deterministic synthetic demo identities + capability profiles
-- (EXECUTION_new2.md Phase 2 seed box). Only synthetic users live in this
-- database. Capabilities are seeded here; the active policy bundle is seeded
-- in code (apps/api/src/db/seed.ts) so its content hash always matches the
-- canonical hash of the declarative bundle.

INSERT INTO users (id, name, account_created_at, created_at) VALUES
  ('user_demo_01', 'Aarav Nair', '2024-03-14T09:30:00.000Z', '2024-03-14T09:30:00.000Z'),
  ('user_demo_02', 'Priya Sharma', '2024-06-02T11:15:00.000Z', '2024-06-02T11:15:00.000Z');

INSERT INTO devices (id, user_id, trusted, first_seen_at, last_seen_at) VALUES
  ('dev_trusted_01', 'user_demo_01', 1, '2024-03-14T09:35:00.000Z', '2026-08-06T18:30:00.000Z'),
  ('dev_new_01',     'user_demo_01', 0, '2026-08-07T08:05:00.000Z', '2026-08-07T08:05:00.000Z'),
  ('dev_trusted_02', 'user_demo_02', 1, '2024-06-02T11:20:00.000Z', '2026-08-05T15:10:00.000Z');

INSERT INTO sessions (id, user_id, device_id, ip_address, asn, country, started_at, failed_login_count) VALUES
  ('sess_home_01', 'user_demo_01', 'dev_trusted_01', '203.0.113.10', 'AS14061', 'IN', '2026-08-07T07:00:00.000Z', 0),
  ('sess_unusual_01', 'user_demo_01', 'dev_new_01', '198.51.100.44', 'AS16509', 'US', '2026-08-07T08:10:00.000Z', 2);

-- Capability profiles (drives the capability gate; missing PASSKEY_ENROLLED
-- makes passkey UNAVAILABLE, never INELIGIBLE).
INSERT INTO user_capabilities (user_id, capability_id, available) VALUES
  ('user_demo_01', 'PASSKEY_ENROLLED', 1),
  ('user_demo_01', 'WEBAUTHN_SUPPORTED', 1),
  ('user_demo_01', 'NETWORK_AVAILABLE', 1),
  ('user_demo_01', 'TOTP_SEED', 0),
  ('user_demo_02', 'PASSKEY_ENROLLED', 0),
  ('user_demo_02', 'WEBAUTHN_SUPPORTED', 1),
  ('user_demo_02', 'NETWORK_AVAILABLE', 1),
  ('user_demo_02', 'TOTP_SEED', 0);
