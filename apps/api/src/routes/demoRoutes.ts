/**
 * Demo routes (EXECUTION_new2.md §5.6, Phase 3/9).
 *
 * GET  /api/v1/demo/scenarios   judge presets (three deterministic scenarios)
 * POST /api/v1/demo/reset       delete demo decisions/challenges/replays so
 *                               the demo restarts deterministically
 *
 * Reset is disabled unless DEMO_MODE=true.
 */
import { Router } from "express";
import { DEMO_SCENARIOS } from "@mfa/demo-data";
import type { Db } from "../db/connection.js";
import { ApiError } from "../middleware/errorHandler.js";

export function createDemoRoutes(deps: { db: Db; demoMode: boolean }): Router {
  const router = Router();

  router.get("/scenarios", (_req, res) => {
    res.json({
      scenarios: DEMO_SCENARIOS.map(({ id, label, description }) => ({ id, label, description })),
    });
  });

  router.post("/reset", (_req, res, next) => {
    try {
      if (!deps.demoMode) {
        throw new ApiError(403, "DEMO_MODE_DISABLED", "Demo reset is disabled outside demo mode");
      }
      const reset = deps.db.transaction(() => {
        deps.db.exec(`
          DELETE FROM verified_remediations;
          DELETE FROM decision_diffs;
          DELETE FROM replay_changes;
          DELETE FROM replays;
          DELETE FROM challenges;
          DELETE FROM trace_events;
          DELETE FROM failed_requirements;
          DELETE FROM factor_evaluations;
          DELETE FROM trust_assessments;
          DELETE FROM threat_assessments;
          DELETE FROM evidence_items;
          DELETE FROM decisions;
          DELETE FROM transactions;
        `);
      });
      reset();
      res.json({ reset: true, at: new Date().toISOString() });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
