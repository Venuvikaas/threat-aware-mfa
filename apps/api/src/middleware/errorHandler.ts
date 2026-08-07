/**
 * Structured JSON error middleware (docs/EXECUTION.md Phase 1/8) plus a small
 * Zod request-validation helper.
 *
 * Handles framework-level failures too: malformed JSON bodies (400), payloads
 * over the configured limit (413), and rate-limit rejections (429) all come
 * back in the same frozen error shape.
 */
import type { NextFunction, Request, Response } from "express";
import type { ZodSchema } from "zod";
import { ERROR_CODES, type ErrorResponse } from "@mfa/contracts";

/** An error that carries a stable machine-readable code and HTTP status. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function validationError(details: unknown, message = "Request validation failed"): ApiError {
  return new ApiError(400, ERROR_CODES.VALIDATION, message, details);
}

export function notFoundError(message = "Resource not found"): ApiError {
  return new ApiError(404, ERROR_CODES.NOT_FOUND, message);
}

export function conflictError(message: string, details?: unknown): ApiError {
  return new ApiError(409, ERROR_CODES.CONFLICT, message, details);
}

export function policyError(message: string, details?: unknown): ApiError {
  return new ApiError(409, ERROR_CODES.POLICY, message, details);
}

export function challengeError(message: string, details?: unknown): ApiError {
  return new ApiError(409, ERROR_CODES.CHALLENGE, message, details);
}

/** Validate `req.body` against a Zod schema and attach the parsed value. */
export function validate<T>(schema: ZodSchema<T>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      next(validationError(result.error.flatten().fieldErrors));
      return;
    }
    req.body = result.data;
    next();
  };
}

export function notFoundHandler(_req: Request, res: Response): void {
  const body: ErrorResponse = {
    error: { code: ERROR_CODES.NOT_FOUND, message: "Route not found" },
  };
  res.status(404).json(body);
}

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof ApiError) {
    respond(res, err.status, err.code, err.message, err.details, req);
    return;
  }

  const anyErr = err as {
    type?: string;
    status?: number;
    statusCode?: number;
    message?: string;
  };

  // Body-parser failures (express.json).
  if (anyErr.type === "entity.parse.failed") {
    respond(res, 400, ERROR_CODES.VALIDATION, "Malformed JSON request body", undefined, req);
    return;
  }
  if (anyErr.type === "entity.too.large") {
    respond(res, 413, ERROR_CODES.PAYLOAD_TOO_LARGE, "Request payload too large", undefined, req);
    return;
  }

  // Framework middlewares (e.g. express-rate-limit) pass a status code.
  const status = anyErr.status ?? anyErr.statusCode;
  if (typeof status === "number") {
    const code =
      status === 429 ? ERROR_CODES.RATE_LIMITED : ERROR_CODES.INTERNAL;
    const message =
      status === 429
        ? "Too many requests — slow down"
        : anyErr.message ?? "Request failed";
    respond(res, status, code, message, undefined, req);
    return;
  }

  console.error(
    `[api] unhandled error corr=${(req as Request & { correlationId?: string }).correlationId ?? "-"}`,
    err
  );
  respond(res, 500, ERROR_CODES.INTERNAL, "Internal server error", undefined, req);
}

function respond(
  res: Response,
  status: number,
  code: string,
  message: string,
  details: unknown,
  req: Request
): void {
  const correlationId = (req as Request & { correlationId?: string }).correlationId;
  const body: ErrorResponse = {
    error: {
      code,
      message,
      ...(details !== undefined && { details }),
      ...(correlationId && { correlationId }),
    },
  };
  res.status(status).json(body);
}
