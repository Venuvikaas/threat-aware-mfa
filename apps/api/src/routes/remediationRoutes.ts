/**
 * Remediation routes (EXECUTION_new2.md §5.5, Phase 7).
 *
 * POST /api/v1/decisions/:decisionId/remediations/:factorId/verify
 *   derive + replay-verify remediation change sets for one factor
 */
import { Router } from "express";
import { FACTOR_IDS, type FactorId } from "@mfa/contracts";
import type { Db } from "../db/connection.js";
import { validationError } from "../middleware/errorHandler.js";
import { RemediationService } from "../services/remediationService.js";

export function createRemediationRoutes(deps: { db: Db }): Router {
  const router = Router();
  const service = new RemediationService(deps.db);

  router.post(
    "/decisions/:decisionId/remediations/:factorId/verify",
    (req, res, next) => {
      try {
        const { factorId } = req.params;
        if (!FACTOR_IDS.includes(factorId as FactorId)) {
          throw validationError({
            factorId: `unknown factor id (expected one of ${FACTOR_IDS.join(", ")})`,
          });
        }
        const response = service.verify(req.params.decisionId, factorId as FactorId);
        res.json(response);
      } catch (err) {
        next(err);
      }
    }
  );

  return router;
}
