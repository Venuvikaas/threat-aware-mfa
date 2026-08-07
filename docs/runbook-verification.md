# Runbook Verification — clean clone to running demo

Phase 10 checklist box: **Verify clone-to-run instructions on a clean
environment** (`test: verify setup runbook`).

## Procedure

The README setup runbook was verified against a fresh clone of the repository
on this machine, following the exact documented steps with no editing of
source, database rows, or configuration:

```bash
git clone <repo> mfa-runbook
cd mfa-runbook
npm install
npm run check        # typecheck + tests + production build
npm run smoke        # end-to-end demo path on a fresh database
```

## Result

| step | exit code | result |
|---|---|---|
| `git clone` | 0 | clean working copy, no `node_modules` |
| `npm install` | 0 | all workspace packages resolve; native deps (better-sqlite3) load |
| `npm run check` | 0 | typecheck ✅ · tests ✅ · production build ✅ |
| `npm run smoke` | 0 | **SMOKE: PASS** on a fresh in-memory database |

Verified: 2026-08-08. The full judged path (SIM-swap decision → phishing
comparison → persisted audit → blocked-factor `POLICY_REJECTION` → passkey
execution → assisted recovery) passes from a cold clone, so a judge machine
that follows the README setup will reach the same state.
