import { describe, expect, it } from "vitest";
import { AppError } from "@/shared/contracts/api-error";
import { GitHubApiError } from "@/server/github/errors";
import { describeImportError, emptyScanSummary, noCleanupSummary } from "./import-transaction";

function githubError(status: number): GitHubApiError {
  return new GitHubApiError({ status, message: "upstream body", remaining: null, resetAt: null, retryAfter: null, githubRequestId: null, fields: [] });
}

describe("import failure description", () => {
  it("uses AppError codes and messages directly", () => {
    const described = describeImportError(new AppError("VALIDATION_ERROR", "Bad input.", 400));
    expect(described).toEqual({ code: "VALIDATION_ERROR", message: "Bad input.", retryable: false });
  });

  it("maps GitHub errors without leaking the upstream message", () => {
    const described = describeImportError(githubError(503));
    expect(described.code).toBe("GITHUB_UNAVAILABLE");
    expect(described.retryable).toBe(true);
    expect(described.message).not.toContain("upstream body");
    expect(describeImportError(githubError(401)).code).toBe("AUTH_RECONNECT_REQUIRED");
    expect(describeImportError(githubError(403)).code).toBe("GITHUB_PERMISSION_DENIED");
    expect(describeImportError(githubError(429)).code).toBe("GITHUB_RATE_LIMITED");
  });

  it("treats aborts as cancelled and unexpected errors as opaque", () => {
    const abort = new Error("aborted");
    abort.name = "AbortError";
    expect(describeImportError(abort)).toMatchObject({ retryable: true });
    expect(describeImportError(new Error("boom"))).toEqual({ code: null, message: "An unexpected error interrupted the import.", retryable: false });
    expect(describeImportError("string")).toMatchObject({ code: null });
  });

  it("exposes safe empty summaries", () => {
    expect(emptyScanSummary).toEqual({ scannedFiles: 0, skippedFiles: 0, scannedBytes: 0, truncated: false });
    expect(noCleanupSummary).toEqual({ refDeleted: false, repositoryDeleted: false, repositoryRemainder: false });
  });
});
