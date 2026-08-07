-- Deterministic synthetic demo identities (docs/EXECUTION.md Phase 1 seed box).
-- Only synthetic users live in this database; everything here is demo data.

INSERT INTO users (id, name, account_created_at, passkey_enrolled, created_at) VALUES
  ('user_demo_01', 'Aarav Nair', '2024-03-14T09:30:00.000Z', 1, '2024-03-14T09:30:00.000Z'),
  ('user_demo_02', 'Priya Sharma', '2024-06-02T11:15:00.000Z', 0, '2024-06-02T11:15:00.000Z');

INSERT INTO devices (id, user_id, trusted, browser_fingerprint, first_seen_at, last_seen_at) VALUES
  ('dev_trusted_01', 'user_demo_01', 1, 'fp-home-chrome-win-7a9f', '2024-03-14T09:35:00.000Z', '2026-08-06T18:30:00.000Z'),
  ('dev_new_01',     'user_demo_01', 0, 'fp-unregistered-mobile-42c1', '2026-08-07T08:05:00.000Z', '2026-08-07T08:05:00.000Z'),
  ('dev_trusted_02', 'user_demo_02', 1, 'fp-office-firefox-9d22', '2024-06-02T11:20:00.000Z', '2026-08-05T15:10:00.000Z');

INSERT INTO sessions (id, user_id, device_id, ip_address, asn, country, started_at, failed_login_count) VALUES
  ('sess_home_01', 'user_demo_01', 'dev_trusted_01', '203.0.113.10', 'AS14061', 'IN', '2026-08-07T07:00:00.000Z', 0),
  ('sess_unusual_01', 'user_demo_01', 'dev_new_01', '198.51.100.44', 'AS16509', 'US', '2026-08-07T08:10:00.000Z', 2);
