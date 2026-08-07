/**
 * Decision routes (docs/EXECUTION.md Phase 3).
 *
 * POST   /api/v1/decisions                 create a decision
 * GET    /api/v1/decisions/:decisionId     retrieve a persisted decision
 * GET    /api/v1/decisions/:decisionId/audit  retrieve the audit timeline
 */
import { Router } from "express";
import { zCreateDecisionRequest } from "@mfa/contracts";
import type { Db } from "../db/connection.js";
import { notFoundError, validate } from "../middleware/errorHandler.js";
import { DecisionService } from "../services/decisionService.js";

export function createDecisionRoutes(deps: { db: Db; demoMode: boolean }): Router {
  const router = Router();
  const service = new DecisionService(deps.db, deps.demoMode);

  router.post("/", validate(zCreateDecisionRequest), (req, res, next) => {
    try {
      const response = service.createDecision(req.body);
      res.status(201).json(response);
    } catch (err) {
      next(err);
    }
  });

  router.get("/:decisionId/audit", (req, res, next) => {
    try {
      const events = service.getAudit(req.params.decisionId);
      if (!events) {
        throw notFoundError(`Decision ${req.params.decisionId} not found`);
      }
      res.json(events);
    } catch (err) {
      next(err);
    }
  });

  router.get("/:decisionId", (req, res, next) => {
    try {
      const decision = service.getDecision(req.params.decisionId);
      if (!decision) {
        throw notFoundError(`Decision ${req.params.decisionId} not found`);
      }
      res.json(decision);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
