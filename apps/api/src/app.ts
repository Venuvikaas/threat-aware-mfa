/**
 * Express application factory for the Threat-Aware MFA Decision Service.
 *
 * `createApp` receives its dependencies (database handle + demo mode) so
 * tests can inject an in-memory database. Hardening (docs/EXECUTION.md
 * Phase 8): payload size limit, rate limiting on critical endpoints, CORS
 * restricted to the configured frontend origin, and correlation IDs on every
 * request and error response.
 */
import cors from "cors";
import express from "express";
import { rateLimit } from "express-rate-limit";
import { ERROR_CODES } from "@mfa/contracts";
import type { Db } from "./db/connection.js";
import { correlationMiddleware } from "./middleware/correlation.js";
import { ApiError, errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { createChallengeRoutes } from "./routes/challengeRoutes.js";
import { createDecisionRoutes } from "./routes/decisionRoutes.js";
import { createDemoRoutes } from "./routes/demoRoutes.js";
import { createPasskeyRoutes } from "./routes/passkeyRoutes.js";

export interface AppDeps {
  db: Db;
  /** Demo-mode toggle; demo routes are disabled outside demo mode. */
  demoMode?: boolean;
  /** Allowed browser origin for CORS (defaults to the Vite dev server). */
  allowedOrigin?: string;
  /** Decision/challenge rate limit per window (tests can raise it). */
  rateLimitCount?: number;
  /** Rate-limit window in milliseconds (tests can shrink it). */
  rateLimitWindowMs?: number;
}

const DEFAULT_RATE_LIMIT_COUNT = 60;
const DEFAULT_RATE_LIMIT_WINDOW_MS = 60_000;

export function createApp(deps: AppDeps): express.Express {
  const app = express();
  const demoMode = deps.demoMode ?? true;
  const allowedOrigin = deps.allowedOrigin ?? process.env.CORS_ORIGIN ?? "http://localhost:5173";

  app.use(correlationMiddleware);
  app.use(
    cors({
      // Only the configured frontend origin is allowed; requests without an
      // Origin header (curl, same-origin) are permitted.
      origin: (origin, callback) => {
        if (!origin || origin === allowedOrigin) {
          callback(null, true);
        } else {
          callback(null, false);
        }
      },
    })
  );
  app.use(express.json({ limit: "32kb" }));

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

  const criticalLimiter = rateLimit({
    windowMs: deps.rateLimitWindowMs ?? DEFAULT_RATE_LIMIT_WINDOW_MS,
    limit: deps.rateLimitCount ?? DEFAULT_RATE_LIMIT_COUNT,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, _res, next) => {
      next(new ApiError(429, ERROR_CODES.RATE_LIMITED, "Too many requests — slow down"));
    },
  });

  app.use("/api/v1/decisions", criticalLimiter);
  app.use("/api/v1/challenges", criticalLimiter);
  app.use("/api/v1/passkeys", criticalLimiter);
  app.use("/api/v1/decisions", createDecisionRoutes({ db: deps.db, demoMode }));
  app.use("/api/v1/challenges", createChallengeRoutes({ db: deps.db, demoMode }));
  app.use("/api/v1/passkeys", createPasskeyRoutes({ db: deps.db, demoMode }));
  app.use("/api/v1/demo", createDemoRoutes({ db: deps.db, demoMode }));

  /* 404 + errors ----------------------------------------------------------- */

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
