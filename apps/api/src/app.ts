/**
 * Express application factory for the Threat-Aware MFA Decision Service.
 *
 * `createApp` receives its dependencies (database handle + demo mode) so
 * tests can inject an in-memory database. Routes: health, decisions + audit,
 * challenges, and demo presets/reset.
 */
import express from "express";
import type { Db } from "./db/connection.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { createChallengeRoutes } from "./routes/challengeRoutes.js";
import { createDecisionRoutes } from "./routes/decisionRoutes.js";
import { createDemoRoutes } from "./routes/demoRoutes.js";

export interface AppDeps {
  db: Db;
  /** Demo-mode toggle; demo routes are disabled outside demo mode. */
  demoMode?: boolean;
}

export function createApp(deps: AppDeps): express.Express {
  const app = express();
  const demoMode = deps.demoMode ?? true;

  app.use(express.json());

  /* Health ----------------------------------------------------------------- */

  app.get("/health", (_req, res) => {
    let databaseOk = false;
    try {
      deps.db.prepare("SELECT 1 AS ok").get();
      databaseOk = true;
    } catch {
      databaseOk = false;
    }
    const status = databaseOk ? "ok" : "degraded";
    res.status(databaseOk ? 200 : 503).json({
      status,
      service: "threat-aware-mfa-api",
      database: databaseOk ? "ok" : "error",
      time: new Date().toISOString(),
    });
  });

  app.get("/", (_req, res) => {
    res.json({
      service: "threat-aware-mfa-api",
      message:
        "Threat-Aware MFA Decision Service. API reference: docs/API.md. Health: GET /health",
    });
  });

  /* API v1 ---------------------------------------------------------------- */

  app.use("/api/v1/decisions", createDecisionRoutes({ db: deps.db, demoMode }));
  app.use("/api/v1/challenges", createChallengeRoutes({ db: deps.db }));
  app.use("/api/v1/demo", createDemoRoutes({ db: deps.db, demoMode }));

  /* 404 + errors ----------------------------------------------------------- */

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
