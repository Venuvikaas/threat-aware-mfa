/**
 * Structured JSON error middleware (docs/EXECUTION.md Phase 1) plus a small
 * Zod request-validation helper used by the decision routes in Phase 3.
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
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof ApiError) {
    const body: ErrorResponse = {
      error: {
        code: err.code,
        message: err.message,
        ...(err.details !== undefined && { details: err.details }),
      },
    };
    res.status(err.status).json(body);
    return;
  }
  console.error("[api] unhandled error", err);
  const body: ErrorResponse = {
    error: { code: ERROR_CODES.INTERNAL, message: "Internal server error" },
  };
  res.status(500).json(body);
}
