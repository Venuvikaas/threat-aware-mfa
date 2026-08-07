/**
 * Challenge routes (docs/EXECUTION.md Phase 6).
 *
 * POST /api/v1/challenges                 create a challenge for an allowed factor
 * POST /api/v1/challenges/:id/verify      verify a one-time expiring challenge
 *
 * The verify request body carries `challengeId` per the frozen contract; the
 * URL segment must match it.
 */
import { Router } from "express";
import { zCreateChallengeRequest, zVerifyChallengeRequest } from "@mfa/contracts";
import type { Db } from "../db/connection.js";
import { validate, validationError } from "../middleware/errorHandler.js";
import { ChallengeService } from "../services/challengeService.js";

export function createChallengeRoutes(deps: { db: Db }): Router {
  const router = Router();
  const service = new ChallengeService(deps.db);

  router.post("/", validate(zCreateChallengeRequest), (req, res, next) => {
    try {
      const response = service.createChallenge(req.body.decisionId, req.body.factor);
      res.status(201).json(response);
    } catch (err) {
      next(err);
    }
  });

  router.post("/:challengeId/verify", validate(zVerifyChallengeRequest), (req, res, next) => {
    try {
      if (req.params.challengeId !== req.body.challengeId) {
        throw validationError({
          challengeId: "path and body challengeId must match",
        });
      }
      const response = service.verifyChallenge(req.body.challengeId, req.body.response);
      res.json(response);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
