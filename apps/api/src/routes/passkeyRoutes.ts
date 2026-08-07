/**
 * Passkey registration routes (docs/EXECUTION_new.md Phase 7).
 *
 * POST /api/v1/passkeys/register/options   begin a WebAuthn registration
 * POST /api/v1/passkeys/register/verify    verify + persist the credential
 *
 * Registration is a demo affordance (the only users are synthetic demo
 * users), so it is disabled outside demo mode, like the enrollment toggle.
 * The Origin header drives RP binding so the ceremony works on the exact
 * host the demo is presented from.
 */
import { Router } from "express";
import {
  zPasskeyRegisterOptionsRequest,
  zPasskeyRegisterVerifyRequest,
} from "@mfa/contracts";
import type { Db } from "../db/connection.js";
import { ApiError, validate } from "../middleware/errorHandler.js";
import { resolveOrigin, WebAuthnService } from "../services/webauthnService.js";

export function createPasskeyRoutes(deps: { db: Db; demoMode: boolean }): Router {
  const router = Router();
  const service = new WebAuthnService(deps.db);

  router.post(
    "/register/options",
    validate(zPasskeyRegisterOptionsRequest),
    async (req, res, next) => {
      try {
        if (!deps.demoMode) {
          throw new ApiError(403, "DEMO_MODE_DISABLED", "Passkey enrollment is disabled outside demo mode");
        }
        const origin = resolveOrigin(req.get("origin"));
        const { ceremonyId, options } = await service.beginRegistration(req.body.userId, origin);
        res.status(201).json({ ceremonyId, options });
      } catch (err) {
        next(err);
      }
    }
  );

  router.post(
    "/register/verify",
    validate(zPasskeyRegisterVerifyRequest),
    async (req, res, next) => {
      try {
        if (!deps.demoMode) {
          throw new ApiError(403, "DEMO_MODE_DISABLED", "Passkey enrollment is disabled outside demo mode");
        }
        const result = await service.completeRegistration({
          ceremonyId: req.body.ceremonyId,
          response: req.body.response,
        });
        res.json(result);
      } catch (err) {
        next(err);
      }
    }
  );

  return router;
}
