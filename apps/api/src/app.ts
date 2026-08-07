/**
 * Express application factory for the Threat-Aware MFA Decision Service.
 *
 * `createApp` receives its dependencies (currently the database handle) so
 * tests can inject an in-memory database. Health checks the live database;
 * decision routes land in Phase 3.
 */
import express from "express";
import type { Db } from "./db/connection.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";

export interface AppDeps {
  db: Db;
  /** Demo-mode toggle; demo routes are disabled outside demo mode. */
  demoMode?: boolean;
}

export function createApp(deps: AppDeps): express.Express {
  const app = express();
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

  /* 404 + errors ----------------------------------------------------------- */

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
