import { z } from "zod";

export const appErrorCodes = [
  "UNAUTHENTICATED", "AUTH_RECONNECT_REQUIRED", "INSUFFICIENT_GITHUB_SCOPE",
  "GITHUB_PERMISSION_DENIED", "GITHUB_RATE_LIMITED", "GITHUB_TIMEOUT", "GITHUB_UNAVAILABLE",
  "GITHUB_CONFLICT", "GITHUB_REQUEST_REJECTED", "REPOSITORY_NOT_FOUND_OR_FORBIDDEN",
  "REPOSITORY_ALREADY_EXISTS", "INVALID_REPOSITORY_NAME", "INVALID_BRANCH_NAME", "README_NOT_FOUND",
  "PAGES_NOT_ENABLED", "PAGES_INVALID_SOURCE", "PAGES_PERMISSION_OR_PLAN_REQUIRED",
  "PAGES_BUILD_NOT_TRIGGERABLE", "ACTIONS_UNAVAILABLE", "ACTIONS_WRITE_PERMISSION_REQUIRED",
  "WORKFLOW_NOT_FOUND", "WORKFLOW_RUN_NOT_FOUND", "WORKFLOW_DISPATCH_INVALID", "INVALID_ZIP",
  "ZIP_TOO_LARGE", "ZIP_UNCOMPRESSED_TOO_LARGE", "ZIP_HAS_NO_IMPORTABLE_FILES", "TOO_MANY_FILES",
  "FILE_TOO_LARGE", "PATH_TOO_LONG", "UNSAFE_ZIP_PATH", "ZIP_PATH_COLLISION",
  "POTENTIAL_SECRET_DETECTED", "IMPORT_PARTIALLY_COMPLETED", "VALIDATION_ERROR", "INTERNAL_ERROR"
] as const;

export const appErrorCodeSchema = z.enum(appErrorCodes);
export type AppErrorCode = z.infer<typeof appErrorCodeSchema>;

export type RateLimitMeta = { remaining: number; resetAt: string | null } | null;
export type ApiSuccess<T> = { ok: true; data: T; meta: { requestId: string; rateLimit: RateLimitMeta } };
export type ApiFailure = {
  ok: false;
  error: { code: AppErrorCode; message: string; fieldErrors: Record<string, string>; retryable: boolean; requestId: string; details?: Record<string, string | number | boolean | null> };
};
export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export class AppError extends Error {
  public readonly details?: Record<string, string | number | boolean | null>;

  constructor(
    public readonly code: AppErrorCode,
    message: string,
    public readonly status = 500,
    public readonly retryable = false,
    public readonly fieldErrors: Record<string, string> = {},
    options?: ErrorOptions & { details?: Record<string, string | number | boolean | null> }
  ) {
    super(message, options);
    this.name = "AppError";
    this.details = options?.details;
  }
}
