# Demo Backup Recording

Phase 10 checklist box: **Capture one backup recording after smoke passes**
(`docs: add demo recording reference`).

## Gate

A backup recording is only captured after the end-to-end smoke check passes on
a fresh database:

```bash
npm run check    # must pass
npm run smoke    # must print SMOKE: PASS
```

Latest gate run: **SMOKE: PASS** (2026-08-08) — see
`docs/runbook-verification.md`.

## Reference

- **Title:** Threat-Aware MFA — decision service demo
- **Duration target:** 2–3 minutes (follows `docs/demo-script.md`)
- **Location (intended):** presentation machine, outside the repository
  (recordings are not committed). Suggested path:
  `~/recordings/threat-aware-mfa-demo.mp4`
- **Checklist before recording:** header shows **API online**; both hero
  cards visible; customer **Aarav Nair (passkey enrolled)**; the **Real
  passkey · WebAuthn** panel reports WebAuthn availability for the exact
  origin used in the recording.

## Notes

- The recording must run on the exact presentation origin (localhost is a
  WebAuthn secure context; a non-secure host automatically uses the labeled
  simulated fallback — either is demo-safe by design).
- The recorded sequence is the demo-script flow: SIM-swap decision → audit →
  phishing comparison (SAME RISK) → blocked SMS challenge rejection → passkey
  execution → assisted recovery → reset.
- If the presentation environment cannot capture a screen recording, a
  narrated walkthrough of the same steps is an acceptable substitute.
