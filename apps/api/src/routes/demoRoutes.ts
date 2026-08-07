/**
 * Demo routes (docs/EXECUTION.md Phase 5/9).
 *
 * GET  /api/v1/demo/users      synthetic identity presets for the forms
 * GET  /api/v1/demo/baseline   fair scalar baseline (server-owned, risk only)
 * POST /api/v1/demo/reset      reset only synthetic demo data (demo mode only)
 */
import { Router } from "express";
import { RISK_LEVELS } from "@mfa/contracts";
import { scalarBaseline } from "@mfa/decision-core";
import type { Db } from "../db/connection.js";
import { ApiError, validationError } from "../middleware/errorHandler.js";
import { DeviceRepository } from "../repositories/deviceRepository.js";
import { UserRepository } from "../repositories/userRepository.js";

export function createDemoRoutes(deps: { db: Db; demoMode: boolean }): Router {
  const router = Router();

  router.get("/users", (_req, res) => {
    const users = new UserRepository(deps.db);
    const devices = new DeviceRepository(deps.db);
    const rows = users.all();
    res.json({
      users: rows.map((u) => ({
        id: u.id,
        name: u.name,
        passkeyEnrolled: u.passkeyEnrolled,
        devices: devices.findByUserId(u.id),
      })),
    });
  });

  router.get("/baseline", (req, res, next) => {
    try {
      const level = String(req.query.riskLevel ?? "");
      if (!RISK_LEVELS.includes(level as (typeof RISK_LEVELS)[number])) {
        throw validationError({ riskLevel: "expected one of LOW, MEDIUM, HIGH" });
      }
      res.json(scalarBaseline(level as (typeof RISK_LEVELS)[number]));
    } catch (err) {
      next(err);
    }
  });

  router.post("/reset", (_req, res, next) => {
    try {
      if (!deps.demoMode) {
        throw new ApiError(403, "DEMO_MODE_DISABLED", "Demo reset is disabled outside demo mode");
      }
      const now = new Date().toISOString();
      const reset = deps.db.transaction(() => {
        deps.db.exec(`
          DELETE FROM audit_events;
          DELETE FROM challenges;
          DELETE FROM factor_evaluations;
          DELETE FROM decisions;
          DELETE FROM signals;
          DELETE FROM transactions;
        `);
      });
      reset();
      res.json({ reset: true, at: now });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
