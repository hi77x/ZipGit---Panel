import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { GitHubClient } from "./client";
import { GitHubApiError, mapGitHubError } from "./errors";
import { parseLinkHeader } from "./pagination";

describe("GitHub transport", () => {
  it("parses RFC Link pagination", () => {
    expect(parseLinkHeader('<https://api.github.com/x?page=2>; rel="next", <https://api.github.com/x?page=4>; rel="last"')).toEqual({ next: "https://api.github.com/x?page=2", last: "https://api.github.com/x?page=4" });
  });
  it("treats a 204 mutation as a typed null success", async () => {
    const mocked = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 204 }));
    await expect(new GitHubClient("server-token", "request-1").request({ method: "POST", path: "/repos/a/b/actions/workflows/1/dispatches", schema: z.null() })).resolves.toMatchObject({ data: null });
    const headers = new Headers(mocked.mock.calls[0]?.[1]?.headers);
    expect(headers.get("Authorization")).toBe("Bearer server-token");
    mocked.mockRestore();
  });
  it("maps auth, rate limit, permission, upstream, and timeout errors", () => {
    const make = (status: number, remaining: number | null = null) => new GitHubApiError({ status, message: "upstream secret", remaining, resetAt: null, retryAfter: null, githubRequestId: null, fields: [] });
    expect(mapGitHubError(make(401)).code).toBe("AUTH_RECONNECT_REQUIRED");
    expect(mapGitHubError(make(403, 0)).code).toBe("GITHUB_RATE_LIMITED");
    expect(mapGitHubError(make(403, 10)).code).toBe("GITHUB_PERMISSION_DENIED");
    expect(mapGitHubError(make(503)).code).toBe("GITHUB_UNAVAILABLE");
    expect(mapGitHubError(make(0)).code).toBe("GITHUB_TIMEOUT");
  });
});
