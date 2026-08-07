/**
 * Correlation ID middleware (docs/EXECUTION.md Phase 8).
 *
 * Accepts an inbound x-correlation-id or generates one, echoes it on every
 * response, and includes it in request logs. Log lines carry method, path,
 * status, duration, and correlation id — never request bodies or secrets.
 */
import type { NextFunction, Request, Response } from "express";
import { randomUUID } from "node:crypto";

export interface CorrelatedRequest extends Request {
  correlationId: string;
}

export function correlationMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const correlationId =
    (req.headers["x-correlation-id"] as string | undefined)?.slice(0, 64) ??
    randomUUID().replace(/-/g, "").slice(0, 16);
  (req as CorrelatedRequest).correlationId = correlationId;
  res.setHeader("x-correlation-id", correlationId);

  const start = Date.now();
  res.on("finish", () => {
    console.log(
      `[api] ${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - start}ms corr=${correlationId}`
    );
  });
  next();
}
