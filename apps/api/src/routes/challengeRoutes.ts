/**
 * Challenge routes (docs/EXECUTION_new.md Phase 6/7).
 *
 * POST /api/v1/challenges                 create a challenge for an allowed factor
 * POST /api/v1/challenges/:id/verify      verify a one-time expiring challenge
 *
 * The verify request body carries `challengeId` per the frozen contract; the
 * URL segment must match it. The request Origin header is forwarded to the
 * factor adapter so a WebAuthn ceremony binds to the exact demo origin — and
 * WEBAUTHN challenges must be verified from the origin they were issued for.
 */
import { Router } from "express";
import { zCreateChallengeRequest, zVerifyChallengeRequest } from "@mfa/contracts";
import type { Db } from "../db/connection.js";
import { validate, validationError } from "../middleware/errorHandler.js";
import { ChallengeService } from "../services/challengeService.js";

export function createChallengeRoutes(deps: {
  db: Db;
  demoMode: boolean;
}): Router {
  const router = Router();
  const service = new ChallengeService(deps.db, deps.demoMode);

  router.post("/", validate(zCreateChallengeRequest), async (req, res, next) => {
    try {
      const response = await service.createChallenge(req.body.decisionId, req.body.factor, {
        origin: req.get("origin"),
        preferSimulated: req.body.preferSimulated,
      });
      res.status(201).json(response);
    } catch (err) {
      next(err);
    }
  });

  router.post("/:challengeId/verify", validate(zVerifyChallengeRequest), async (req, res, next) => {
    try {
      if (req.params.challengeId !== req.body.challengeId) {
        throw validationError({
          challengeId: "path and body challengeId must match",
        });
      }
      const response = await service.verifyChallenge(
        req.body.challengeId,
        req.body.response,
        { origin: req.get("origin") }
      );
      res.json(response);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
