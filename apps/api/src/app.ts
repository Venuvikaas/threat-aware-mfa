/**
 * Express application shell for the Threat-Aware MFA Decision Service.
 *
 * Phase 0 scope: structured JSON errors and a minimal health endpoint so the
 * package starts independently. Decision routes, persistence, engines, and
 * factor adapters land in Phases 1-6.
 */
import express from "express";
import { ERROR_CODES, type ErrorResponse } from "@mfa/contracts";

export const app = express();

app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "threat-aware-mfa-api",
    database: "not_initialized", // Phase 1 replaces with a live access check
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

/* 404 ------------------------------------------------------------------ */

app.use((_req, res) => {
  const body: ErrorResponse = {
    error: { code: ERROR_CODES.NOT_FOUND, message: "Route not found" },
  };
  res.status(404).json(body);
});

/* Error middleware ------------------------------------------------------- */

app.use(
  (
    err: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error("[api] unhandled error", err);
    const body: ErrorResponse = {
      error: {
        code: ERROR_CODES.INTERNAL,
        message: "Internal server error",
      },
    };
    res.status(500).json(body);
  }
);
