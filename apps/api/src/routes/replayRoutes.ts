/**
 * Replay routes (EXECUTION_new2.md §5.4, Phase 6).
 *
 * POST /api/v1/decisions/:decisionId/replays   create an exact or fork replay
 * GET  /api/v1/replays/:replayId               replay record + produced decision
 * GET  /api/v1/replays/:replayId/diff          structured semantic diff
 */
import { Router } from "express";
import { zCreateReplayRequest } from "@mfa/contracts";
import type { Db } from "../db/connection.js";
import { notFoundError, validate } from "../middleware/errorHandler.js";
import { ReplayService } from "../services/replayService.js";

export function createReplayRoutes(deps: { db: Db }): Router {
  const router = Router();
  const service = new ReplayService(deps.db);

  router.post("/decisions/:decisionId/replays", validate(zCreateReplayRequest), (req, res, next) => {
    try {
      const record = service.createReplay(req.params.decisionId, req.body);
      res.status(201).json(record);
    } catch (err) {
      next(err);
    }
  });

  router.get("/replays/:replayId/diff", (req, res, next) => {
    try {
      const diff = service.getDiff(req.params.replayId);
      if (!diff) {
        throw notFoundError(`Replay ${req.params.replayId} not found`);
      }
      res.json(diff);
    } catch (err) {
      next(err);
    }
  });

  router.get("/replays/:replayId", (req, res, next) => {
    try {
      const result = service.getReplay(req.params.replayId);
      if (!result) {
        throw notFoundError(`Replay ${req.params.replayId} not found`);
      }
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
