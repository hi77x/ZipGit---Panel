import { AppError, type AppErrorCode } from "@/shared/contracts/api-error";

export type GitHubErrorDetails = {
  status: number;
  message: string;
  remaining: number | null;
  resetAt: string | null;
  retryAfter: number | null;
  githubRequestId: string | null;
  fields: Array<{ resource?: string; field?: string; code?: string }>;
};

export class GitHubApiError extends Error {
  constructor(public readonly details: GitHubErrorDetails) {
    super(details.message);
    this.name = "GitHubApiError";
  }
}

export function mapGitHubError(error: GitHubApiError, context?: AppErrorCode): AppError {
  const { status, remaining, resetAt } = error.details;
  if (status === -2) return new AppError("GITHUB_SCHEMA_MISMATCH", "GitHub returned an unexpected response shape.", 502, true);
  if (status === 0) return new AppError("GITHUB_TIMEOUT", "GitHub did not respond before the request timed out.", 504, true);
  if (status === 401) return new AppError("AUTH_RECONNECT_REQUIRED", "Your GitHub authorization expired. Reconnect to continue.", 401);
  if ((status === 403 && remaining === 0) || status === 429) {
    const suffix = resetAt ? ` Try again after ${new Date(resetAt).toLocaleTimeString()}.` : " Try again later.";
    return new AppError("GITHUB_RATE_LIMITED", `GitHub rate limit reached.${suffix}`, 429, true);
  }
  if (status === 403) return new AppError(context ?? "GITHUB_PERMISSION_DENIED", "GitHub did not grant permission for this operation.", 403);
  if (status === 404) return new AppError(context ?? "REPOSITORY_NOT_FOUND_OR_FORBIDDEN", "The GitHub resource was not found or is not accessible.", 404);
  if (status === 409) return new AppError(context ?? "GITHUB_CONFLICT", "GitHub reported a conflicting state.", 409);
  if (status === 422) return new AppError(context ?? "GITHUB_REQUEST_REJECTED", "GitHub rejected the supplied values.", 422);
  if (status >= 500) return new AppError("GITHUB_UNAVAILABLE", "GitHub is temporarily unavailable.", 503, true);
  return new AppError("INTERNAL_ERROR", "The GitHub request could not be completed.", 500);
}
