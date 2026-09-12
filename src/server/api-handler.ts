import "server-only";
import { NextResponse } from "next/server";
import { log } from "@/lib/logger";
import { requestIdFrom } from "@/lib/request-id";
import { AppError, type ApiFailure, type ApiSuccess, type RateLimitMeta } from "@/shared/contracts/api-error";
import { GitHubApiError, mapGitHubError } from "@/server/github/errors";
import { counter, histogram, normalizeRoute, withSpan } from "@/server/observability/telemetry";

export type ApiContext = { requestId: string; rateLimit: RateLimitMeta };

export async function handleApi<T>(
  request: Request,
  handler: (context: ApiContext) => Promise<T>,
  options: { cache?: string } = {}
): Promise<NextResponse<ApiSuccess<T> | ApiFailure>> {
  const requestId = requestIdFrom(request);
  const context: ApiContext = { requestId, rateLimit: null };
  const method = request.method;
  const route = normalizeRoute(new URL(request.url).pathname);
  const started = performance.now();
  try {
    const data = await withSpan("http.request", { requestId, method, route }, () => handler(context));
    const durationMs = Math.round(performance.now() - started);
    counter("repodeck.http.requests", "HTTP requests handled").add(1, { method, route, status: "ok" });
    histogram("repodeck.http.request.duration", "HTTP request duration").record(durationMs, { method, route });
    log("info", { requestId, route, method, status: 200, durationMs });
    return NextResponse.json(
      { ok: true, data, meta: { requestId, rateLimit: context.rateLimit } },
      { headers: responseHeaders(requestId, options.cache ?? "no-store") }
    );
  } catch (unknownError) {
    if (unknownError instanceof GitHubApiError) {
      context.rateLimit = { remaining: unknownError.details.remaining ?? 0, resetAt: unknownError.details.resetAt };
    }
    const error = normalizeError(unknownError);
    const durationMs = Math.round(performance.now() - started);
    counter("repodeck.http.requests", "HTTP requests handled").add(1, { method, route, status: "error" });
    counter("repodeck.http.errors", "HTTP error responses").add(1, { route, errorCode: error.code });
    histogram("repodeck.http.request.duration", "HTTP request duration").record(durationMs, { method, route });
    log("error", {
      requestId, route, method,
      errorCode: error.code, errorName: unknownError instanceof Error ? unknownError.name : "Unknown", durationMs
    });
    const retryAfter = error.code === "GITHUB_RATE_LIMITED" && context.rateLimit?.resetAt
      ? Math.max(1, Math.ceil((Date.parse(context.rateLimit.resetAt) - Date.now()) / 1000)) : null;
    const headers = responseHeaders(requestId, "no-store");
    if (retryAfter) headers.set("Retry-After", String(retryAfter));
    return NextResponse.json(
      { ok: false, error: { code: error.code, message: error.message, fieldErrors: error.fieldErrors, retryable: error.retryable, requestId, details: error.details } },
      { status: error.status, headers }
    );
  }
}

function normalizeError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  if (error instanceof GitHubApiError) {
    if (error.details.status === 0) return new AppError("GITHUB_TIMEOUT", "GitHub did not respond in time.", 504, true);
    return mapGitHubError(error);
  }
  return new AppError("INTERNAL_ERROR", "An unexpected error occurred.", 500, false, {}, { cause: error });
}

function responseHeaders(requestId: string, cacheControl: string): Headers {
  return new Headers({ "Cache-Control": cacheControl, "X-Request-Id": requestId });
}
