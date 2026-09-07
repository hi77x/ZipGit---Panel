import { describe, expect, it, vi } from "vitest";
import { GitHubApiError } from "@/server/github/errors";
import type { GitHubClient } from "@/server/github/client";
import type { RepositoryService } from "./repository-service";
import { PagesService } from "./pages-service";
import { actionEligibility } from "./actions-service";

describe("Pages and Actions domain states", () => {
  it("maps a Pages 404 to disabled when the repository is accessible", async () => {
    const github = { request: vi.fn().mockRejectedValue(new GitHubApiError({ status: 404, message: "Not Found", remaining: 100, resetAt: null, retryAfter: null, githubRequestId: "x", fields: [] })) } as unknown as GitHubClient;
    const repositories = { assertAccessible: vi.fn().mockResolvedValue(undefined), branches: vi.fn().mockResolvedValue(["main"]) } as unknown as RepositoryService;
    await expect(new PagesService(github, repositories).get("octo", "repo")).resolves.toEqual({ status: "disabled", branches: ["main"] });
  });
  it("exposes workflow actions only for eligible run states", () => {
    expect(actionEligibility("queued")).toEqual({ canCancel: true, canRerun: false });
    expect(actionEligibility("in_progress").canCancel).toBe(true);
    expect(actionEligibility("completed")).toEqual({ canCancel: false, canRerun: true });
  });
});
